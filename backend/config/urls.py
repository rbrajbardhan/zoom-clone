"""
URL configuration for the zoom-clone Django project.

Route map
---------
  /admin/                          — Django admin panel
  /api/meetings/                   — List all / create meeting
  /api/meetings/upcoming/          — Upcoming scheduled meetings
  /api/meetings/recent/            — Recent meetings
  /api/meetings/<meeting_id>/      — Meeting detail
  /api/meetings/<meeting_id>/join/ — Join a meeting
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/meetings/', include('meetings.urls', namespace='meetings')),
]
