"""Seed data for Menderes Mahallesi 325. Sokak kentsel dönüşüm project."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.accounts.models import ProjectMembership, RoleCode
from apps.ledger.models import (
    PaymentPlan,
    Transaction,
    TransactionCategory,
    TransactionDirection,
    TransactionStatus,
)
from apps.ledger.services import post_transaction
from apps.parties.models import Owner, UnitOwnership
from apps.projects.models import Block, Project, ProjectStatus, Unit
from apps.projects.setup import seed_default_categories

User = get_user_model()

MENDERES_PROJECT_CODE = "menderes-325-sok"

# Yarısı Bizden: malik katılım payı (yaklaşık toplam inşaat maliyetinin %50'si)
UNIT_SPECS = [
    # unit_number, floor, m2, owner_key, owner_name, owner_share, plan?, total, installments, paid_count
    ("1", 1, "88.00", "mehmet-demir", "Mehmet Demir", True, "1400000", 12, 8),
    ("2", 1, "92.00", "fatma-ozturk", "Fatma Öztürk", True, "1450000", 10, 10),
    ("3", 2, "95.00", "ali-korkmaz", "Ali Korkmaz", False, None, 0, 1),  # tek sefer, plansız
    ("4", 2, "95.00", "zeynep-arslan", "Zeynep Arslan", True, "1400000", 12, 2),
    ("5", 3, "102.00", "hasan-celik", "Hasan Çelik", True, "1550000", 6, 3),
    ("6", 3, "88.00", "emine-yildiz", "Emine Yıldız", False, None, 0, 0),  # henüz ödeme yok
    ("7", 4, "110.00", "mustafa-koc", "Mustafa Koç", True, "1650000", 12, 12),
    ("8", 4, "98.00", "ayse-sahin", "Ayşe Şahin", True, "1480000", 24, 5),
]

EXPENSE_SPECS = [
    ("2025-09-12", "cimento", "325. Sokak temel betonu — çimento", "185000.00"),
    ("2025-10-08", "demir", "Zemin kat demir donatı", "420000.00"),
    ("2025-11-15", "iscilik", "Kalıp ve demir montaj işçiliği", "310000.00"),
    ("2025-12-03", "nakliye", "Demir ve malzeme nakliyesi", "45000.00"),
    ("2026-01-20", "cimento", "1. kat dökümü çimento", "92000.00"),
    ("2026-02-14", "demir", "1–2. kat demir", "280000.00"),
    ("2026-03-05", "iscilik", "Beton döküm ve işçilik", "195000.00"),
    ("2026-04-01", "genel-gider", "Şantiye elektrik-su, ruhsat harçları", "38000.00"),
]

PLAN_START = date(2025, 6, 1)
LUMP_PAYMENT = Decimal("500000.00")  # Ali Korkmaz — plansız kısmi ödeme


def _add_months(start: date, months: int) -> date:
    from calendar import monthrange

    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, monthrange(year, month)[1])
    return date(year, month, day)


def _ensure_demo_users(password: str) -> dict:
    users = {}
    for username, display in [
        ("demo_admin", "Ayhan Ercan"),
        ("demo_contractor", "Müteahhit"),
    ]:
        user, created = User.objects.get_or_create(username=username)
        if created:
            user.set_password(password)
            user.save()
        users[username] = user
    return users


def _post_inflow(
    *,
    project,
    unit,
    owner,
    category,
    amount: Decimal,
    txn_date: date,
    description: str,
    user,
    idempotency_key: str,
) -> Transaction:
    txn, _ = Transaction.objects.update_or_create(
        project=project,
        idempotency_key=idempotency_key,
        defaults={
            "unit": unit,
            "owner": owner,
            "category": category,
            "transaction_date": txn_date,
            "amount": amount,
            "direction": TransactionDirection.INFLOW,
            "description": description,
            "status": TransactionStatus.DRAFT,
            "created_by": user,
            "updated_by": user,
        },
    )
    if txn.status == TransactionStatus.DRAFT:
        post_transaction(txn)
    return txn


def _post_outflow(
    *,
    project,
    category,
    amount: Decimal,
    txn_date: date,
    description: str,
    user,
    idempotency_key: str,
) -> Transaction:
    txn, _ = Transaction.objects.update_or_create(
        project=project,
        idempotency_key=idempotency_key,
        defaults={
            "unit": None,
            "owner": None,
            "category": category,
            "transaction_date": txn_date,
            "amount": amount,
            "direction": TransactionDirection.OUTFLOW,
            "description": description,
            "status": TransactionStatus.DRAFT,
            "created_by": user,
            "updated_by": user,
        },
    )
    if txn.status == TransactionStatus.DRAFT:
        post_transaction(txn)
    return txn


@transaction.atomic
def seed_menderes_project(*, password: str = "demo1234", stdout=None) -> Project:
    from apps.accounts.models import Role

    roles = {role.code: role for role in Role.objects.all()}
    users = _ensure_demo_users(password)
    admin = users["demo_admin"]
    contractor = users["demo_contractor"]

    project, _ = Project.objects.update_or_create(
        code=MENDERES_PROJECT_CODE,
        defaults={
            "name": "Menderes Mah. 325. Sokak Kentsel Dönüşüm",
            "address": "Menderes Mahallesi, 325. Sokak, Konak / İzmir",
            "description": (
                "Yarısı Bizden Kampanyası kapsamında 8 daireli apartman "
                "kentsel dönüşüm projesi. Malik katılım payı toplam maliyetin "
                "yaklaşık %50'sidir."
            ),
            "currency": "TRY",
            "status": ProjectStatus.ACTIVE,
            "is_deleted": False,
            "deleted_at": None,
            "created_by": admin,
            "updated_by": admin,
        },
    )

    for username, role_code in [
        ("demo_admin", RoleCode.ADMIN),
        ("demo_contractor", RoleCode.CONTRACTOR),
    ]:
        ProjectMembership.objects.update_or_create(
            user=users[username],
            project=project,
            defaults={"role": roles[role_code], "is_active": True},
        )

    seed_default_categories(project)
    categories = {c.slug: c for c in TransactionCategory.objects.filter(project=project)}
    odeme = categories["odeme"]

    block, _ = Block.objects.update_or_create(
        project=project,
        code="325",
        defaults={
            "name": "325. Sokak Apartmanı",
            "sort_order": 0,
            "is_deleted": False,
            "deleted_at": None,
            "created_by": admin,
            "updated_by": admin,
        },
    )

    owners: dict[str, Owner] = {}
    units: dict[str, Unit] = {}

    for spec in UNIT_SPECS:
        (
            unit_number,
            floor,
            area,
            owner_key,
            owner_name,
            has_plan,
            total_str,
            installments,
            paid_count,
        ) = spec

        owner, _ = Owner.objects.update_or_create(
            email=f"{owner_key}@menderes.local",
            defaults={
                "full_name": owner_name,
                "phone": "0232 000 0000",
                "is_deleted": False,
                "deleted_at": None,
                "created_by": admin,
                "updated_by": admin,
            },
        )
        owners[owner_key] = owner

        unit, _ = Unit.objects.update_or_create(
            project=project,
            block=block,
            unit_number=unit_number,
            defaults={
                "floor": floor,
                "gross_area_m2": Decimal(area),
                "notes": "Yarısı Bizden katılım payı",
                "is_deleted": False,
                "deleted_at": None,
                "created_by": admin,
                "updated_by": admin,
            },
        )
        units[unit_number] = unit

        UnitOwnership.objects.update_or_create(
            unit=unit,
            owner=owner,
            effective_from=date(2025, 1, 1),
            defaults={
                "ownership_share": Decimal("1.0000"),
                "is_primary_contact": True,
                "created_by": admin,
                "updated_by": admin,
            },
        )

        if has_plan and total_str:
            total = Decimal(total_str)
            PaymentPlan.objects.update_or_create(
                project=project,
                unit=unit,
                owner=owner,
                defaults={
                    "total_amount": total,
                    "installment_count": installments,
                    "start_date": PLAN_START,
                    "notes": "Yarısı Bizden — malik katılım payı taksit planı",
                    "created_by": admin,
                    "updated_by": admin,
                },
            )
            monthly = (total / installments).quantize(Decimal("0.01"))
            for i in range(paid_count):
                pay_date = _add_months(PLAN_START, i)
                _post_inflow(
                    project=project,
                    unit=unit,
                    owner=owner,
                    category=odeme,
                    amount=monthly,
                    txn_date=pay_date,
                    description=f"{i + 1}. taksit — Yarısı Bizden katılım payı",
                    user=contractor,
                    idempotency_key=f"menderes-pay-{unit_number}-inst-{i + 1}",
                )
        elif owner_key == "ali-korkmaz":
            _post_inflow(
                project=project,
                unit=unit,
                owner=owner,
                category=odeme,
                amount=LUMP_PAYMENT,
                txn_date=date(2025, 8, 15),
                description="Peşin katılım ödemesi (taksit planı yok)",
                user=contractor,
                idempotency_key="menderes-pay-3-lump",
            )

    for idx, (date_str, cat_slug, desc, amount_str) in enumerate(EXPENSE_SPECS):
        y, m, d = (int(x) for x in date_str.split("-"))
        cat = categories[cat_slug]
        _post_outflow(
            project=project,
            category=cat,
            amount=Decimal(amount_str),
            txn_date=date(y, m, d),
            description=desc,
            user=contractor,
            idempotency_key=f"menderes-expense-{idx + 1}",
        )

    if stdout:
        stdout.write(f"Project: {project.name} ({project.code})")
        stdout.write(f"Units: {len(units)}, Owners: {len(owners)}")
        stdout.write(
            f"Payments: {Transaction.objects.filter(project=project, direction=TransactionDirection.INFLOW).count()}"
        )
        stdout.write(
            f"Expenses: {Transaction.objects.filter(project=project, direction=TransactionDirection.OUTFLOW).count()}"
        )
        stdout.write(f"Payment plans: {PaymentPlan.objects.filter(project=project).count()}")

    return project
