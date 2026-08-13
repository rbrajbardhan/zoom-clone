"""
meetings/urls.py

URL patterns for the meetings API.

All patterns are mounted under /api/meetings/ by config/urls.py.

IMPORTANT — ordering matters:
  'upcoming/' and 'recent/' must be defined BEFORE '<str:meeting_id>/'
  because Django matches URL patterns top-to-bottom. If '<str:meeting_id>/'
  came first, a request to /api/meetings/upcoming/ would be caught by
  the detail view and attempt to find a meeting with id="upcoming".
"""

from django.urls import path

from . import views

app_name = 'meetings'

urlpatterns = [
    # ----------------------------------------------------------------
    # Collection endpoints  (no path variable)
    # ----------------------------------------------------------------

    # GET  /api/meetings/       → list all meetings
    # POST /api/meetings/       → create instant or scheduled meeting
    path(
        '',
        views.MeetingListCreateView.as_view(),
        name='list-create',
    ),

    # ----------------------------------------------------------------
    # Named sub-routes  (must come BEFORE the <meeting_id> catch-all)
    # ----------------------------------------------------------------

    # GET /api/meetings/upcoming/ → list upcoming scheduled meetings
    path(
        'upcoming/',
        views.UpcomingMeetingsView.as_view(),
        name='upcoming',
    ),

    # GET /api/meetings/recent/ → list recent meetings
    path(
        'recent/',
        views.RecentMeetingsView.as_view(),
        name='recent',
    ),

    # ----------------------------------------------------------------
    # Per-meeting endpoints  (path variable: meeting_id)
    # ----------------------------------------------------------------

    # GET /api/meetings/<meeting_id>/ → retrieve one meeting
    path(
        '<str:meeting_id>/',
        views.MeetingDetailView.as_view(),
        name='detail',
    ),

    # POST /api/meetings/<meeting_id>/join/ → join a meeting
    path(
        '<str:meeting_id>/join/',
        views.MeetingJoinView.as_view(),
        name='join',
    ),
]
