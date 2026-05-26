from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.accounts.models import Role, RoleCode
from apps.ledger.models import DirectionHint, TransactionCategory
from apps.projects.models import Project, ProjectStatus


DEFAULT_CATEGORIES = [
    ("Goodwill adjustment", DirectionHint.EITHER),
    ("Share adjustment", DirectionHint.EITHER),
    ("Contribution fee (katılım bedeli)", DirectionHint.INFLOW),
    ("Payment", DirectionHint.OUTFLOW),
    ("Refund", DirectionHint.OUTFLOW),
]


class Command(BaseCommand):
    help = "Seed roles and optionally default transaction categories for a project."

    def add_arguments(self, parser):
        parser.add_argument(
            "--project-code",
            type=str,
            help="Create default categories for the project with this code.",
        )

    def handle(self, *args, **options):
        roles = [
            (RoleCode.ADMIN, "Administrator", "Full system access"),
            (RoleCode.CONTRACTOR, "Contractor", "Manage projects and ledger"),
            (RoleCode.OWNER, "Owner", "Read-only portal access (future)"),
        ]
        for code, name, description in roles:
            Role.objects.update_or_create(
                code=code,
                defaults={"name": name, "description": description},
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(roles)} roles."))

        project_code = options.get("project_code")
        if not project_code:
            return

        project, created = Project.objects.get_or_create(
            code=project_code,
            defaults={
                "name": project_code.replace("-", " ").title(),
                "status": ProjectStatus.ACTIVE,
            },
        )
        if created:
            self.stdout.write(f"Created project: {project}")

        for sort_order, (name, direction_hint) in enumerate(DEFAULT_CATEGORIES):
            slug = slugify(name)[:64]
            TransactionCategory.objects.update_or_create(
                project=project,
                slug=slug,
                defaults={
                    "name": name,
                    "direction_hint": direction_hint,
                    "sort_order": sort_order,
                    "is_active": True,
                },
            )
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(DEFAULT_CATEGORIES)} categories for project '{project.code}'."
            )
        )
