"""
meetings/serializers.py

Defines the DRF serializers that form the API data contract for the
Zoom Clone backend.

Serializer index
----------------
  MeetingSerializer        — Full Meeting read/create representation.
  ParticipantSerializer    — Full Participant read representation.
  ParticipantJoinSerializer— Write serializer for the join-meeting action.
                             Accepts only display_name; the view derives
                             the meeting from the URL.

Design decisions
----------------
  - The internal integer primary key (id) is NEVER exposed in any serializer.
    All public-facing references use meeting_id (e.g. "abc-defg-hij").
  - meeting_id, status, and created_at are read-only: the backend always
    controls their values.
  - invite_link is a computed SerializerMethodField. It is derived from
    meeting_id at runtime and is never stored in the database.
  - Status is set automatically in create() based on meeting_type so the
    frontend cannot accidentally set an inconsistent initial status.
  - Validation is designed to produce clear, field-scoped error messages
    that the Next.js frontend can display directly next to the relevant input.
"""

from rest_framework import serializers

from .models import Meeting, Participant


# ---------------------------------------------------------------------------
# Meeting serializer
# ---------------------------------------------------------------------------

class MeetingSerializer(serializers.ModelSerializer):
    """
    Full Meeting representation.

    Used for:
      GET  /api/meetings/              → list of meetings
      GET  /api/meetings/<meeting_id>/ → single meeting detail
      POST /api/meetings/              → create instant or scheduled meeting

    Read-only fields (never accepted from the client)
    --------------------------------------------------
      meeting_id  — auto-generated server-side by Meeting.save()
      status      — auto-set in create() based on meeting_type;
                    transitions are managed by dedicated action endpoints
      created_at  — auto-set by auto_now_add on the model
      invite_link — derived at runtime from meeting_id + FRONTEND_URL setting

    Writable fields (accepted from the client on POST)
    ---------------------------------------------------
      meeting_type     required
      title            optional for instant (defaults to "Instant Meeting"),
                       required for scheduled
      description      optional
      scheduled_at     required for scheduled, must be absent for instant
      duration_minutes optional (defaults to 60)

    Instant meeting minimum request body
    -------------------------------------
      {"meeting_type": "instant"}

    Scheduled meeting minimum request body
    ----------------------------------------
      {
        "meeting_type":     "scheduled",
        "title":            "Team Standup",
        "scheduled_at":     "2026-08-14T10:00:00Z",
        "duration_minutes": 60
      }
    """

    # SerializerMethodField — derived at runtime, never stored in the DB.
    invite_link = serializers.SerializerMethodField(
        help_text="Full shareable URL. Derived from meeting_id + settings.FRONTEND_URL.",
    )

    class Meta:
        model = Meeting
        fields = [
            'meeting_id',        # read-only: auto-generated
            'meeting_type',      # writable: 'instant' | 'scheduled'
            'title',             # writable: display title
            'description',       # writable: optional notes
            'scheduled_at',      # writable: NULL for instant, datetime for scheduled
            'duration_minutes',  # writable: 1–1440, default 60
            'status',            # read-only: auto-managed server-side
            'created_at',        # read-only: auto_now_add
            'invite_link',       # read-only: computed
        ]
        read_only_fields = [
            'meeting_id',
            'status',
            'created_at',
        ]

    # ------------------------------------------------------------------
    # Computed field
    # ------------------------------------------------------------------

    def get_invite_link(self, obj: Meeting) -> str:
        """
        Return the full shareable invite URL.

        Delegates to the Meeting.invite_link property, which reads
        settings.FRONTEND_URL so the domain is never hardcoded here.
        """
        return obj.invite_link

    # ------------------------------------------------------------------
    # Field-level validation
    # ------------------------------------------------------------------

    def validate_duration_minutes(self, value: int) -> int:
        """
        Validate duration at the API layer so the client gets a clear
        error message rather than a DB-level constraint failure.
        """
        if value < 1:
            raise serializers.ValidationError(
                "Duration must be at least 1 minute."
            )
        if value > 1440:
            raise serializers.ValidationError(
                "Duration cannot exceed 1440 minutes (24 hours)."
            )
        return value

    def validate_title(self, value: str) -> str:
        """Strip leading/trailing whitespace from titles."""
        return value.strip()

    # ------------------------------------------------------------------
    # Object-level (cross-field) validation
    # ------------------------------------------------------------------

    def validate(self, attrs: dict) -> dict:
        """
        Cross-field validation enforcing the meeting_type / scheduled_at
        consistency rules:

          instant   → scheduled_at must be absent or NULL
          scheduled → scheduled_at must be provided and non-null
                    → title must be a real title, not the instant default

        These rules only apply on creation (self.instance is None).
        On PATCH updates the caller may be modifying unrelated fields,
        so we re-check only the fields present in attrs.
        """
        is_create = self.instance is None

        # On updates, fall back to the existing instance value for fields
        # that were not included in the PATCH body.
        if is_create:
            meeting_type = attrs.get('meeting_type')
            scheduled_at = attrs.get('scheduled_at')
            title        = attrs.get('title', Meeting._meta.get_field('title').default)
        else:
            meeting_type = attrs.get('meeting_type', self.instance.meeting_type)
            scheduled_at = attrs.get('scheduled_at', self.instance.scheduled_at)
            title        = attrs.get('title', self.instance.title)

        if meeting_type == Meeting.MeetingType.SCHEDULED:
            # Scheduled meetings MUST have a scheduled date/time.
            if not scheduled_at:
                raise serializers.ValidationError({
                    'scheduled_at': (
                        "Scheduled meetings require a scheduled date and time."
                    )
                })
            # Scheduled meetings MUST have a real title (not just the
            # instant-meeting default).
            if is_create and (
                not title
                or not title.strip()
                or title.strip() == 'Instant Meeting'
            ):
                raise serializers.ValidationError({
                    'title': (
                        "Scheduled meetings require a meaningful title."
                    )
                })

        elif meeting_type == Meeting.MeetingType.INSTANT:
            # Instant meetings MUST NOT carry a scheduled date/time.
            if scheduled_at:
                raise serializers.ValidationError({
                    'scheduled_at': (
                        "Instant meetings cannot have a scheduled date and time."
                    )
                })

        return attrs

    # ------------------------------------------------------------------
    # Create — auto-assign initial status based on meeting_type
    # ------------------------------------------------------------------

    def create(self, validated_data: dict) -> Meeting:
        """
        Auto-set the initial status before the DB insert.

          instant   → status = 'active'    (starts immediately)
          scheduled → status = 'scheduled' (waiting for its start time)

        The status field is read-only in the serializer so validated_data
        will never carry a client-supplied status.  We inject it here
        programmatically before calling super().create().
        """
        meeting_type = validated_data.get('meeting_type')

        if meeting_type == Meeting.MeetingType.INSTANT:
            validated_data['status'] = Meeting.Status.ACTIVE
        else:
            # Covers 'scheduled' and any future types that are not instant.
            validated_data['status'] = Meeting.Status.SCHEDULED

        return super().create(validated_data)


# ---------------------------------------------------------------------------
# Participant serializers
# ---------------------------------------------------------------------------

class ParticipantSerializer(serializers.ModelSerializer):
    """
    Full Participant read representation.

    Used for:
      GET /api/meetings/<meeting_id>/      (participants nested in meeting detail)
      GET /api/meetings/<meeting_id>/join/ (list of current participants)

    The meeting is represented by meeting_id (the public identifier) rather
    than the internal integer FK so no DB implementation detail leaks out.

    All fields are read-only: participants are created only through the
    dedicated join action, never via a bare POST to a participant list.
    """

    # Surface the public meeting_id instead of the internal integer FK.
    meeting_id = serializers.CharField(
        source='meeting.meeting_id',
        read_only=True,
    )

    class Meta:
        model = Participant
        fields = [
            'id',           # read-only: internal PK (needed for participant-level actions)
            'meeting_id',   # read-only: public meeting identifier
            'display_name', # the name typed before joining
            'joined_at',    # read-only: auto-set at join time
            'left_at',      # nullable: NULL while still in the meeting
        ]
        read_only_fields = [
            'id',
            'meeting_id',
            'joined_at',
        ]


class ParticipantJoinSerializer(serializers.ModelSerializer):
    """
    Write serializer for POST /api/meetings/<meeting_id>/join/.

    The frontend sends only the participant's chosen display name:

        {"display_name": "Raj Mehta"}

    The view:
      1. Looks up the Meeting by <meeting_id> from the URL.
      2. Validates the meeting is not 'completed' or 'cancelled'.
      3. Calls serializer.save(meeting=<meeting_instance>) so the FK
         is injected server-side — never trusted from the request body.
      4. joined_at is set automatically by auto_now_add on the model.

    The response uses ParticipantSerializer (the full read form) so the
    caller receives a complete participant record including joined_at.
    """

    class Meta:
        model = Participant
        fields = ['display_name']

    def validate_display_name(self, value: str) -> str:
        """
        Enforce basic display-name hygiene.

        Rules:
          - Cannot be blank or whitespace-only.
          - Must be at least 2 characters after stripping.
          - Maximum length is enforced by the model field (max_length=100).
        """
        stripped = value.strip()

        if not stripped:
            raise serializers.ValidationError(
                "Display name cannot be blank."
            )
        if len(stripped) < 2:
            raise serializers.ValidationError(
                "Display name must be at least 2 characters long."
            )

        return stripped
