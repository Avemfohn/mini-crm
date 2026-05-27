from django.conf import settings
from django.core.management.base import BaseCommand

from apps.accounts.management.commands.seed_menderes_data import (
    MENDERES_PROJECT_CODE,
    seed_menderes_project,
)
from apps.accounts.management.commands.seed_data import Command as SeedDataCommand


class Command(BaseCommand):
    help = (
        "Seed Menderes Mahallesi 325. Sokak kentsel dönüşüm project with "
        "Yarısı Bizden payment plans, owner payments, and construction expenses."
    )

    def handle(self, *args, **options):
        SeedDataCommand()._seed_roles()
        password = settings.DEMO_USER_PASSWORD
        seed_menderes_project(password=password, stdout=self.stdout)
        self.stdout.write(self.style.SUCCESS("Menderes project seeded successfully."))
        self.stdout.write("")
        self.stdout.write(f"Project code: {MENDERES_PROJECT_CODE}")
        self.stdout.write("Login as demo_admin / demo1234 to view.")
