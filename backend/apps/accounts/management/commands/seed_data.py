from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import ProjectMembership, Role, RoleCode, UserProfile
from apps.ledger.models import (
    Transaction,
    TransactionCategory,
    TransactionDirection,
    TransactionStatus,
)
from apps.ledger.services import post_transaction, void_transaction
from apps.parties.models import Owner, UnitOwnership
from apps.projects.models import Block, Project, ProjectStatus, Unit
from apps.projects.setup import seed_default_categories

User = get_user_model()

DEMO_PROJECT_CODE = "demo-kentsel"


class Command(BaseCommand):
    help = "Seed roles and optionally default transaction categories or full demo data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--project-code",
            type=str,
            help="Create default categories for the project with this code.",
        )
        parser.add_argument(
            "--demo",
            action="store_true",
            help="Seed a full demo project with users, units, owners, and transactions.",
        )
        parser.add_argument(
            "--menderes",
            action="store_true",
            help="Seed Menderes Mah. 325. Sokak real-life kentsel dönüşüm project.",
        )

    def handle(self, *args, **options):
        self._seed_roles()

        if options.get("demo"):
            self._require_demo_password()
            self._seed_demo()
            return

        if options.get("menderes"):
            from apps.accounts.management.commands.seed_menderes_data import (
                MENDERES_PROJECT_CODE,
                seed_menderes_project,
            )

            password = self._require_demo_password()
            seed_menderes_project(password=password, stdout=self.stdout)
            self.stdout.write(self.style.SUCCESS("Menderes project seeded successfully."))
            self.stdout.write(f"Project code: {MENDERES_PROJECT_CODE}")
            return

        project_code = options.get("project_code")
        if project_code:
            project, _ = Project.objects.get_or_create(
                code=project_code,
                defaults={
                    "name": project_code.replace("-", " ").title(),
                    "status": ProjectStatus.ACTIVE,
                },
            )
            self._seed_categories(project)
            self.stdout.write(self.style.SUCCESS(f"Seeded categories for '{project.code}'."))

    def _seed_roles(self):
        roles = [
            (RoleCode.ADMIN, "Yönetici", "Tam yetki"),
            (RoleCode.CONTRACTOR, "Müteahhit", "Günlük işlemler ve kayıtlar"),
            (RoleCode.OWNER, "Malik", "Salt okunur erişim"),
        ]
        for code, name, description in roles:
            Role.objects.update_or_create(
                code=code,
                defaults={"name": name, "description": description},
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(roles)} roles."))

    def _seed_categories(self, project):
        seed_default_categories(project)

    def _require_demo_password(self) -> str:
        password = settings.DEMO_USER_PASSWORD
        if not password:
            raise CommandError(
                "Set DEMO_USER_PASSWORD before running demo or Menderes seed commands."
            )
        if password == "demo1234":
            raise CommandError(
                "DEMO_USER_PASSWORD must not be demo1234 in production."
            )
        return password

    @transaction.atomic
    def _seed_demo(self):
        password = self._require_demo_password()
        roles = {role.code: role for role in Role.objects.all()}

        demo_users = {}
        for username, role_code, display_name in [
            ("demo_admin", RoleCode.ADMIN, "Demo Admin"),
            ("demo_contractor", RoleCode.CONTRACTOR, "Demo Contractor"),
            ("demo_owner", RoleCode.OWNER, "Demo Owner"),
        ]:
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.set_password(password)
                user.save()
            demo_users[username] = user
            UserProfile.objects.update_or_create(
                user=user,
                defaults={"display_name": display_name, "locale": "tr"},
            )

        project, _ = Project.objects.update_or_create(
            code=DEMO_PROJECT_CODE,
            defaults={
                "name": "Demo Kentsel Dönüşüm",
                "address": "Kadıköy, İstanbul",
                "description": "Demo urban transformation project",
                "currency": "TRY",
                "status": ProjectStatus.ACTIVE,
                "is_deleted": False,
                "deleted_at": None,
                "created_by": demo_users["demo_admin"],
                "updated_by": demo_users["demo_admin"],
            },
        )

        for username, role_code in [
            ("demo_admin", RoleCode.ADMIN),
            ("demo_contractor", RoleCode.CONTRACTOR),
            ("demo_owner", RoleCode.OWNER),
        ]:
            ProjectMembership.objects.update_or_create(
                user=demo_users[username],
                project=project,
                defaults={"role": roles[role_code], "is_active": True},
            )

        self._seed_categories(project)
        categories = {
            cat.slug: cat
            for cat in TransactionCategory.objects.filter(project=project)
        }
        payment_category = categories["odeme"]
        spending_category = categories["genel-gider"]

        blocks = {}
        for code, name, sort_order in [("a", "Blok A", 0), ("b", "Blok B", 1)]:
            block, _ = Block.objects.update_or_create(
                project=project,
                code=code,
                defaults={
                    "name": name,
                    "sort_order": sort_order,
                    "is_deleted": False,
                    "deleted_at": None,
                    "created_by": demo_users["demo_admin"],
                    "updated_by": demo_users["demo_admin"],
                },
            )
            blocks[code] = block

        units = {}
        unit_specs = [
            ("a", "101", 1),
            ("a", "102", 2),
            ("a", "103", 3),
            ("b", "201", 4),
            ("b", "202", 5),
            ("b", "203", 6),
        ]
        for block_code, unit_number, floor in unit_specs:
            unit, _ = Unit.objects.update_or_create(
                project=project,
                block=blocks[block_code],
                unit_number=unit_number,
                defaults={
                    "floor": floor,
                    "gross_area_m2": Decimal("95.00"),
                    "is_deleted": False,
                    "deleted_at": None,
                    "created_by": demo_users["demo_admin"],
                    "updated_by": demo_users["demo_admin"],
                },
            )
            units[f"{block_code}-{unit_number}"] = unit

        owners = {}
        owner_specs = [
            ("ahmet-yilmaz", "Ahmet Yılmaz", None),
            ("ayse-kaya", "Ayşe Kaya", None),
            ("demo-owner-profile", "Demo Owner", demo_users["demo_owner"]),
        ]
        for key, full_name, user in owner_specs:
            owner, _ = Owner.objects.update_or_create(
                email=f"{key}@example.com",
                defaults={
                    "full_name": full_name,
                    "user": user,
                    "is_deleted": False,
                    "deleted_at": None,
                    "created_by": demo_users["demo_admin"],
                    "updated_by": demo_users["demo_admin"],
                },
            )
            owners[key] = owner

        ownership_specs = [
            (units["a-101"], owners["demo-owner-profile"], Decimal("1.0000")),
            (units["a-102"], owners["ahmet-yilmaz"], Decimal("1.0000")),
            (units["b-201"], owners["ayse-kaya"], Decimal("0.5000")),
        ]
        for unit, owner, share in ownership_specs:
            UnitOwnership.objects.update_or_create(
                unit=unit,
                owner=owner,
                effective_from="2024-01-01",
                defaults={
                    "ownership_share": share,
                    "is_primary_contact": True,
                    "created_by": demo_users["demo_admin"],
                    "updated_by": demo_users["demo_admin"],
                },
            )

        draft_txn, _ = Transaction.objects.update_or_create(
            project=project,
            idempotency_key="demo-draft-contribution",
            defaults={
                "unit": units["a-101"],
                "owner": owners["demo-owner-profile"],
                "category": payment_category,
                "transaction_date": "2024-03-01",
                "amount": Decimal("50000.00"),
                "direction": TransactionDirection.INFLOW,
                "description": "Pending contribution fee",
                "status": TransactionStatus.DRAFT,
                "created_by": demo_users["demo_contractor"],
                "updated_by": demo_users["demo_contractor"],
            },
        )

        active_txn, created = Transaction.objects.get_or_create(
            project=project,
            idempotency_key="demo-active-contribution",
            defaults={
                "unit": units["a-102"],
                "owner": owners["ahmet-yilmaz"],
                "category": payment_category,
                "transaction_date": "2024-04-01",
                "amount": Decimal("75000.00"),
                "direction": TransactionDirection.INFLOW,
                "description": "Posted contribution fee",
                "status": TransactionStatus.DRAFT,
                "created_by": demo_users["demo_contractor"],
                "updated_by": demo_users["demo_contractor"],
            },
        )
        if active_txn.status == TransactionStatus.DRAFT:
            post_transaction(active_txn)

        void_txn, _ = Transaction.objects.get_or_create(
            project=project,
            idempotency_key="demo-voided-payment",
            defaults={
                "unit": units["b-201"],
                "owner": owners["ayse-kaya"],
                "category": spending_category,
                "transaction_date": "2024-05-01",
                "amount": Decimal("10000.00"),
                "direction": TransactionDirection.OUTFLOW,
                "description": "Voided contractor payment",
                "status": TransactionStatus.DRAFT,
                "created_by": demo_users["demo_contractor"],
                "updated_by": demo_users["demo_contractor"],
            },
        )
        if void_txn.status == TransactionStatus.DRAFT:
            post_transaction(void_txn)
        void_txn.refresh_from_db()
        if void_txn.status == TransactionStatus.ACTIVE:
            void_transaction(
                void_txn,
                voided_by=demo_users["demo_contractor"],
                void_reason="Demo void",
                create_reversal=False,
            )

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
        self.stdout.write("")
        self.stdout.write("Demo logins (password from DEMO_USER_PASSWORD):")
        for username in demo_users:
            self.stdout.write(f"  - {username}")
        self.stdout.write(f"Project code: {DEMO_PROJECT_CODE}")
        self.stdout.write(f"API login: POST /api/v1/auth/token/")
        self.stdout.write(
            f"Transactions: draft={draft_txn.id}, active={active_txn.id}, voided={void_txn.id}"
        )
