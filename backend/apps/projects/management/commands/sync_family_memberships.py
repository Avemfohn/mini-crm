from django.core.management.base import BaseCommand

from apps.projects.services import sync_all_family_memberships


class Command(BaseCommand):
    help = (
        "Add every active user as Müteahhit on all projects "
        "(when SHARED_PROJECT_ACCESS is enabled)."
    )

    def handle(self, *args, **options):
        created = sync_all_family_memberships()
        self.stdout.write(
            self.style.SUCCESS(f"Family memberships synced ({created} new links).")
        )
