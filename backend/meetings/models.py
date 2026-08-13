"""
meetings/models.py

Defines the two core database entities for the Zoom Clone backend:

  - Meeting   : represents both instant and scheduled meetings.
  - Participant: represents one person's join session inside a meeting.
"""

import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def generate_meeting_id() -> str:
    """
    Generate a unique public Meeting ID in the format ``abc-defg-hij``.

    Strategy
    --------
    1. Take a random UUID4 (128 bits of randomness).
    2. Strip hyphens to get 32 hex characters.
    3. Slice the first 10 characters and format them as:
         xxx-xxxx-xxx   (3-4-3 groups separated by hyphens)

    This yields ~1 trillion possible IDs (16^10), making accidental
    collisions astronomically unlikely.  The caller is responsible for
    retrying if a collision does occur (see Meeting.save()).

    Examples
    --------
    >>> generate_meeting_id()
    'f47-ac10b5-8c'   # (illustrative; actual format: 3-4-3)
    """
    raw = uuid.uuid4().hex  # 32-char hex string, e.g. "f47ac10b58cc4372a567..."
    # Slice 10 chars and split into 3-4-3
    chars = raw[:10]
    return f"{chars[0:3]}-{chars[3:7]}-{chars[7:10]}"


# ---------------------------------------------------------------------------
# Meeting
# ---------------------------------------------------------------------------

class Meeting(models.Model):
    """
    Represents a meeting — either an instant session or a scheduled event.

    Instant meeting
    ---------------
      meeting_type = 'instant'
      scheduled_at = NULL
      status       = 'active'   (starts immediately)

    Scheduled meeting
    -----------------
      meeting_type  = 'scheduled'
      scheduled_at  = <future datetime>
      status        = 'scheduled'  (transitions to 'active' → 'completed')
    """

    # ------------------------------------------------------------------
    # Choices
    # ------------------------------------------------------------------

    class MeetingType(models.TextChoices):
        INSTANT   = 'instant',   'Instant'
        SCHEDULED = 'scheduled', 'Scheduled'

    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', 'Scheduled'   # future meeting, not yet started
        ACTIVE    = 'active',    'Active'       # currently in progress
        COMPLETED = 'completed', 'Completed'    # ended normally
        CANCELLED = 'cancelled', 'Cancelled'    # cancelled before it started

    # ------------------------------------------------------------------
    # Fields
    # ------------------------------------------------------------------

    # Internal PK — used for DB joins/FKs; never sent to the frontend.
    id = models.BigAutoField(primary_key=True)

    # Public-facing identifier used in URLs and invite links.
    # Generated server-side; never accepted from the frontend.
    # db_index=True is implied by unique=True.
    meeting_id = models.CharField(
        max_length=12,
        unique=True,
        editable=False,
        help_text="Auto-generated public ID (format: abc-defg-hij).",
    )

    # Discriminates between instant and scheduled meetings.
    meeting_type = models.CharField(
        max_length=10,
        choices=MeetingType.choices,
        help_text="'instant' or 'scheduled'.",
    )

    # Display title shown on dashboards and meeting cards.
    # Instant meetings default to "Instant Meeting"; scheduled meetings
    # must supply a meaningful title (enforced at the serializer layer).
    title = models.CharField(
        max_length=255,
        default='Instant Meeting',
        help_text="Meeting title. Defaults to 'Instant Meeting' for instant-type meetings.",
    )

    # Optional free-text notes or agenda (mainly used for scheduled meetings).
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Optional agenda or description.",
    )

    # NULL for instant meetings; required for scheduled meetings.
    # Indexed because it is the primary field used to filter
    # upcoming (> now) and recent (< now) meeting lists.
    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Planned start time. NULL for instant meetings.",
    )

    # Expected duration in minutes.
    # Validators enforce 1 ≤ duration ≤ 1440 (24 h) at the Django layer.
    # A CheckConstraint below enforces the lower bound at the DB level.
    duration_minutes = models.PositiveIntegerField(
        default=60,
        validators=[
            MinValueValidator(1),
            MaxValueValidator(1440),
        ],
        help_text="Meeting duration in minutes (1–1440).",
    )

    # Lifecycle status — drives upcoming/recent derivation.
    # Indexed because nearly every list query filters on this field.
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.SCHEDULED,
        db_index=True,
        help_text="Current meeting lifecycle status.",
    )

    # Audit timestamp — set automatically at creation, never modified.
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="UTC timestamp of when the meeting record was created.",
    )

    # ------------------------------------------------------------------
    # Meta
    # ------------------------------------------------------------------

    class Meta:
        ordering = ['-created_at']
        constraints = [
            # Enforce duration > 0 at the database level.
            models.CheckConstraint(
                check=models.Q(duration_minutes__gte=1),
                name='meeting_duration_positive',
            ),
        ]

    # ------------------------------------------------------------------
    # Save / ID generation
    # ------------------------------------------------------------------

    def save(self, *args, **kwargs) -> None:
        """
        Auto-generate ``meeting_id`` on first save.

        Retries on the (astronomically unlikely) event of a collision.
        """
        if not self.meeting_id:
            candidate = generate_meeting_id()
            # Retry until we find a unique ID.
            while Meeting.objects.filter(meeting_id=candidate).exists():
                candidate = generate_meeting_id()
            self.meeting_id = candidate
        super().save(*args, **kwargs)

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def invite_link(self) -> str:
        """
        Return the full shareable invite URL for this meeting.

        The frontend base URL is read from ``settings.FRONTEND_URL`` so that
        the domain is never hardcoded in model code and can differ between
        development (http://localhost:3000) and production environments.

        The complete URL is *derived* and never stored in the database.
        """
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        return f"{frontend_url}/meeting/{self.meeting_id}"

    # ------------------------------------------------------------------
    # Dunder methods
    # ------------------------------------------------------------------

    def __str__(self) -> str:
        return f"[{self.meeting_id}] {self.title} ({self.get_status_display()})"


# ---------------------------------------------------------------------------
# Participant
# ---------------------------------------------------------------------------

class Participant(models.Model):
    """
    Represents one person's join session in a meeting.

    One Meeting → many Participants (one-to-many relationship).

    A participant row is created when someone calls POST /api/meetings/<id>/join/.
    ``left_at`` remains NULL while they are in the meeting and is set when
    they disconnect.

    Notes
    -----
    - No uniqueness is enforced on (meeting, display_name): two people
      sharing the same name in one meeting is allowed.
    - If the same person rejoins (e.g., after a disconnect), a new row
      is created.  This keeps the join history intact.
    """

    # ------------------------------------------------------------------
    # Fields
    # ------------------------------------------------------------------

    # Internal PK.
    id = models.BigAutoField(primary_key=True)

    # Foreign key to the parent meeting.
    # CASCADE: deleting a meeting automatically removes all its participant rows.
    # db_index=True: indexed so that "get all participants for meeting X" is fast.
    meeting = models.ForeignKey(
        Meeting,
        on_delete=models.CASCADE,
        related_name='participants',
        db_index=True,
        help_text="The meeting this participant joined.",
    )

    # The name typed by the participant before joining.
    display_name = models.CharField(
        max_length=100,
        help_text="Display name entered by the participant.",
    )

    # Set automatically when the row is created (i.e., when join is called).
    joined_at = models.DateTimeField(
        auto_now_add=True,
        help_text="UTC timestamp of when the participant joined.",
    )

    # NULL while in the meeting; filled in when the participant leaves.
    left_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="UTC timestamp of when the participant left. NULL if still in the meeting.",
    )

    # ------------------------------------------------------------------
    # Meta
    # ------------------------------------------------------------------

    class Meta:
        ordering = ['joined_at']

    # ------------------------------------------------------------------
    # Dunder methods
    # ------------------------------------------------------------------

    def __str__(self) -> str:
        status = "in meeting" if self.left_at is None else "left"
        return f"{self.display_name} @ [{self.meeting.meeting_id}] ({status})"
