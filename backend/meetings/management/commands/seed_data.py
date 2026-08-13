import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from meetings.models import Meeting

class Command(BaseCommand):
    help = "Seed the database with sample meeting data for the Zoom Clone dashboard."

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear seeded sample meetings from the database',
        )

    def handle(self, *args, **options):
        seed_titles = [
            'Weekly Team Sync',
            'Architecture Brainstorming',
            'Sprint Review & Demo',
            'Instant Sync-Up'
        ]

        if options['clear']:
            deleted_count, _ = Meeting.objects.filter(title__in=seed_titles).delete()
            self.stdout.write(
                self.style.SUCCESS(f"Successfully cleared {deleted_count} sample meetings from the database.")
            )
            return

        now = timezone.now()
        samples = [
            {
                'meeting_type': Meeting.MeetingType.SCHEDULED,
                'title': 'Weekly Team Sync',
                'description': 'Align on current sprint tasks, address blockers, and plan the upcoming week.',
                'scheduled_at': now + datetime.timedelta(days=1, hours=2),
                'duration_minutes': 45,
                'status': Meeting.Status.SCHEDULED,
            },
            {
                'meeting_type': Meeting.MeetingType.SCHEDULED,
                'title': 'Architecture Brainstorming',
                'description': 'Discussions on moving our Django Channels in-memory layer to Redis and coturn TURN server configurations.',
                'scheduled_at': now + datetime.timedelta(hours=4),
                'duration_minutes': 90,
                'status': Meeting.Status.SCHEDULED,
            },
            {
                'meeting_type': Meeting.MeetingType.SCHEDULED,
                'title': 'Sprint Review & Demo',
                'description': 'Demoing in-meeting chat, participant lists, and browser-based recording features.',
                'scheduled_at': now - datetime.timedelta(days=2),
                'duration_minutes': 60,
                'status': Meeting.Status.COMPLETED,
            },
            {
                'meeting_type': Meeting.MeetingType.INSTANT,
                'title': 'Instant Sync-Up',
                'description': 'Ad-hoc call to debug WebRTC signaling exchange.',
                'scheduled_at': now - datetime.timedelta(hours=1),
                'duration_minutes': 15,
                'status': Meeting.Status.COMPLETED,
            }
        ]

        created_count = 0
        for item in samples:
            # Check for existing meeting with the same title to ensure idempotency
            meeting, created = Meeting.objects.get_or_create(
                title=item['title'],
                defaults=item
            )
            if created:
                created_count += 1
                self.stdout.write(f"Created sample meeting: {meeting.title} ({meeting.meeting_id})")
            else:
                self.stdout.write(f"Sample meeting already exists: {meeting.title}")

        self.stdout.write(
            self.style.SUCCESS(f"Seeding completed. Created {created_count} new sample meetings.")
        )
