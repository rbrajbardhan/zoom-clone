"""
meetings/admin.py

Registers Meeting and Participant with the Django admin site.
The configuration is intentionally kept lightweight — just enough to be
useful during development (readable list views, search, and filtering).
"""

from django.contrib import admin

from .models import Meeting, Participant


# ---------------------------------------------------------------------------
# Inline: show participants directly on the Meeting detail page
# ---------------------------------------------------------------------------

class ParticipantInline(admin.TabularInline):
    """
    Displays a compact participant table within the Meeting admin page.
    This avoids having to navigate away to see who joined.
    """
    model = Participant
    extra = 0          # don't show empty "add" rows by default
    readonly_fields = ('display_name', 'joined_at', 'left_at')
    can_delete = False  # participants should not be deleted from the meeting admin


# ---------------------------------------------------------------------------
# Meeting admin
# ---------------------------------------------------------------------------

@admin.register(Meeting)
class MeetingAdmin(admin.ModelAdmin):
    """Admin configuration for the Meeting model."""

    # Columns shown in the meeting list view.
    list_display = (
        'meeting_id',
        'title',
        'meeting_type',
        'status',
        'scheduled_at',
        'duration_minutes',
        'created_at',
    )

    # Sidebar filters for quick narrowing.
    list_filter = ('meeting_type', 'status')

    # Search across title, meeting_id, and description.
    search_fields = ('title', 'meeting_id', 'description')

    # Fields that cannot be edited via the admin form.
    # meeting_id is auto-generated; created_at is auto-set.
    readonly_fields = ('meeting_id', 'created_at', 'invite_link')

    # Show participants inline on the Meeting detail page.
    inlines = [ParticipantInline]

    # Fieldset layout on the Meeting detail/edit page.
    fieldsets = (
        ('Identity', {
            'fields': ('meeting_id', 'meeting_type', 'status'),
        }),
        ('Details', {
            'fields': ('title', 'description', 'duration_minutes'),
        }),
        ('Scheduling', {
            'fields': ('scheduled_at',),
        }),
        ('Sharing', {
            'fields': ('invite_link',),
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',),  # hide by default; expand if needed
        }),
    )


# ---------------------------------------------------------------------------
# Participant admin
# ---------------------------------------------------------------------------

@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    """Admin configuration for the Participant model."""

    list_display = ('display_name', 'meeting', 'joined_at', 'left_at')
    list_filter  = ('meeting__status',)
    search_fields = ('display_name', 'meeting__meeting_id', 'meeting__title')
    readonly_fields = ('joined_at',)
