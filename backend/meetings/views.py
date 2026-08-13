"""
meetings/views.py

Implements the REST API views for the Zoom Clone backend.

Endpoint index
--------------
  MeetingListCreateView   GET  /api/meetings/
                          POST /api/meetings/

  MeetingDetailView       GET  /api/meetings/<meeting_id>/

  MeetingJoinView         POST /api/meetings/<meeting_id>/join/

  UpcomingMeetingsView    GET  /api/meetings/upcoming/

  RecentMeetingsView      GET  /api/meetings/recent/

Design principles
-----------------
  - All views use APIView (Django REST Framework class-based views).
    This makes request-method handling explicit (def get / def post)
    without any hidden magic — easy to read and explain in an interview.

  - Public meeting_id is used in all URLs. The internal integer PK
    is never exposed in any URL or response body.

  - Validation lives in serializers, not in views. Views call
    serializer.is_valid() and delegate all validation logic there.

  - Errors use DRF's built-in exception classes (NotFound → 404,
    ValidationError → 400) which automatically produce JSON responses.

  - django.utils.timezone.now() is used everywhere instead of
    datetime.now() so all comparisons are timezone-aware.

Ordering note for upcoming vs recent
--------------------------------------
  upcoming → ordered by scheduled_at ASC  (nearest first)
  recent   → ordered by COALESCE(scheduled_at, created_at) DESC
             (most recently active first; instant meetings fall back
              to created_at because their scheduled_at is NULL)
"""

from django.db.models import Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Meeting, Participant
from .serializers import (
    MeetingSerializer,
    ParticipantJoinSerializer,
    ParticipantSerializer,
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def get_meeting_or_404(meeting_id: str) -> Meeting:
    """
    Fetch a Meeting by its public meeting_id.

    Raises DRF's NotFound (→ HTTP 404 JSON response) if no matching
    meeting exists.  Using this helper keeps the try/except boilerplate
    out of every view method.
    """
    try:
        return Meeting.objects.get(meeting_id=meeting_id)
    except Meeting.DoesNotExist:
        raise NotFound(detail="Meeting not found.")


# ---------------------------------------------------------------------------
# GET /api/meetings/
# POST /api/meetings/
# ---------------------------------------------------------------------------

class MeetingListCreateView(APIView):
    """
    GET  → Return all meetings, newest first.
    POST → Create an instant or scheduled meeting.

    POST accepts:
      {"meeting_type": "instant"}                          ← minimal instant
      {"meeting_type": "scheduled", "title": "...", ...}  ← scheduled

    POST rejects (→ 400):
      meeting_type = scheduled, missing scheduled_at
      meeting_type = scheduled, missing/default title
      meeting_type = instant, scheduled_at provided
      duration_minutes out of range

    The serializer's create() auto-sets status:
      instant   → active
      scheduled → scheduled
    """

    def get(self, request) -> Response:
        meetings = Meeting.objects.all()  # Meta.ordering = ['-created_at']
        serializer = MeetingSerializer(meetings, many=True)
        return Response(serializer.data)

    def post(self, request) -> Response:
        serializer = MeetingSerializer(data=request.data)
        if serializer.is_valid():
            meeting = serializer.save()
            # Re-serialize so the response includes the auto-generated meeting_id and invite_link
            return Response(
                MeetingSerializer(meeting).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# GET /api/meetings/<meeting_id>/
# ---------------------------------------------------------------------------

class MeetingDetailView(APIView):
    """
    GET → Return a single meeting identified by its public meeting_id.

    Returns 404 with {"detail": "Meeting not found."} if the ID does not exist.
    The internal database PK is never used in this URL or response.
    """

    def get(self, request, meeting_id: str) -> Response:
        meeting = get_meeting_or_404(meeting_id)
        serializer = MeetingSerializer(meeting)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# POST /api/meetings/<meeting_id>/join/
# ---------------------------------------------------------------------------

class MeetingJoinView(APIView):
    """
    POST → Join an existing meeting as a participant.

    Request body:
      {"display_name": "Raj Mehta"}

    The meeting FK is derived from the URL — the client cannot choose it.
    joined_at is set automatically by auto_now_add on the Participant model.

    Responses:
      201  Participant created; returns full participant record.
      400  display_name validation failed.
      404  Meeting not found.

    Multiple participants with the same display_name are allowed in the
    same meeting (see schema design decision: no uniqueness on display_name).
    """

    def post(self, request, meeting_id: str) -> Response:
        meeting = get_meeting_or_404(meeting_id)

        if meeting.status in [Meeting.Status.COMPLETED, Meeting.Status.CANCELLED]:
            return Response(
                {"detail": "This meeting has already ended."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        join_serializer = ParticipantJoinSerializer(data=request.data)
        if not join_serializer.is_valid():
            return Response(
                join_serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        participant = join_serializer.save(meeting=meeting)

        response_serializer = ParticipantSerializer(participant)
        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# GET /api/meetings/upcoming/
# ---------------------------------------------------------------------------

class UpcomingMeetingsView(APIView):
    """
    GET → Return upcoming scheduled meetings for the dashboard.

    A meeting is "upcoming" if ALL of the following are true:
      - meeting_type = 'scheduled'
        (instant meetings have no scheduled_at and are never "upcoming")
      - status is 'scheduled' or 'active'
        (completed/cancelled meetings are excluded)
      - scheduled_at > now()
        (the meeting has not yet passed)

    Ordered by scheduled_at ASC so the nearest upcoming meeting appears first.

    This list is derived entirely from existing fields — no is_upcoming flag.
    """

    def get(self, request) -> Response:
        now = timezone.now()

        upcoming = Meeting.objects.filter(
            meeting_type=Meeting.MeetingType.SCHEDULED,
            status__in=[Meeting.Status.SCHEDULED, Meeting.Status.ACTIVE],
            scheduled_at__gt=now,
        ).order_by('scheduled_at')

        serializer = MeetingSerializer(upcoming, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# GET /api/meetings/recent/
# ---------------------------------------------------------------------------

class RecentMeetingsView(APIView):
    """
    GET → Return recent meetings for the dashboard.

    A meeting is "recent" if it belongs to one of these categories:

    Category A — Completed meetings (any type)
      status = 'completed'
      These are definitively in the past regardless of type.

    Category B — Active instant meetings
      meeting_type = 'instant', status = 'active'
      Instant meetings start immediately on creation, so an active one
      is currently happening and belongs on the recent/active list.

    Category C — Scheduled meetings whose time has passed
      meeting_type = 'scheduled', scheduled_at <= now()
      These may still be 'scheduled' or 'active' in status (e.g. the host
      hasn't updated the status yet), but their time slot has arrived so
      they appear on the recent list.

    Exclusions
    ----------
      Cancelled meetings are intentionally excluded (they are not shown as
      normal recent meetings — they can be surfaced separately if needed).

    Ordering
    --------
      COALESCE(scheduled_at, created_at) DESC
        - For scheduled meetings: uses scheduled_at (the event time)
        - For instant meetings:   falls back to created_at (scheduled_at=NULL)
      This produces a unified chronological feed regardless of meeting type.

    No time-window limit is applied here (e.g. "last 30 days") because
    the SQLite dataset is small.  A window can be added in a future phase
    if the list grows unwieldy.
    """

    def get(self, request) -> Response:
        now = timezone.now()

        recent = Meeting.objects.filter(
            # Category A: any completed meeting
            Q(status=Meeting.Status.COMPLETED)
            |
            # Category B: instant meetings that are currently active
            Q(
                meeting_type=Meeting.MeetingType.INSTANT,
                status=Meeting.Status.ACTIVE,
            )
            |
            # Category C: scheduled meetings whose time slot has arrived
            Q(
                meeting_type=Meeting.MeetingType.SCHEDULED,
                scheduled_at__lte=now,
                status__in=[Meeting.Status.SCHEDULED, Meeting.Status.ACTIVE],
            )
        ).exclude(
            # Explicitly drop cancelled meetings from the recent feed.
            status=Meeting.Status.CANCELLED,
        ).order_by(
            # Unified event-time sort: uses scheduled_at when available,
            # falls back to created_at for instant meetings (NULL scheduled_at).
            Coalesce('scheduled_at', 'created_at').desc()
        )

        serializer = MeetingSerializer(recent, many=True)
        return Response(serializer.data)
