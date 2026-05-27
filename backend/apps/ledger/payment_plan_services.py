from calendar import monthrange
from datetime import date
from decimal import Decimal

from django.db.models import Sum

from apps.ledger.models import (
    DirectionHint,
    PaymentPlan,
    Transaction,
    TransactionCategory,
    TransactionDirection,
    TransactionStatus,
)


def _add_months(start: date, months: int) -> date:
    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, monthrange(year, month)[1])
    return date(year, month, day)


def _month_bounds(due: date) -> tuple[date, date]:
    last_day = monthrange(due.year, due.month)[1]
    return date(due.year, due.month, 1), date(due.year, due.month, last_day)


def build_payment_schedule(plan: PaymentPlan) -> list[dict]:
    monthly = plan.monthly_amount
    rows = []
    for i in range(plan.installment_count):
        due_date = _add_months(plan.start_date, i)
        period_start, period_end = _month_bounds(due_date)
        paid = (
            Transaction.objects.filter(
                project_id=plan.project_id,
                unit_id=plan.unit_id,
                owner_id=plan.owner_id,
                status=TransactionStatus.ACTIVE,
                direction=TransactionDirection.INFLOW,
                transaction_date__gte=period_start,
                transaction_date__lte=period_end,
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0")
        )
        remaining = max(monthly - paid, Decimal("0"))
        rows.append(
            {
                "installment": i + 1,
                "due_date": due_date.isoformat(),
                "expected": str(monthly),
                "paid": str(paid.quantize(Decimal("0.01"))),
                "remaining": str(remaining.quantize(Decimal("0.01"))),
            }
        )
    return rows


def get_default_category(project, direction=None):
    if direction == TransactionDirection.OUTFLOW:
        category = TransactionCategory.objects.filter(
            project=project,
            slug="genel-gider",
            is_deleted=False,
        ).first()
        if category:
            return category
        return (
            TransactionCategory.objects.filter(
                project=project,
                is_deleted=False,
                direction_hint=DirectionHint.OUTFLOW,
            )
            .order_by("sort_order")
            .first()
        )

    category = TransactionCategory.objects.filter(
        project=project,
        slug="odeme",
        is_deleted=False,
    ).first()
    if category:
        return category
    return (
        TransactionCategory.objects.filter(
            project=project,
            is_deleted=False,
            direction_hint=DirectionHint.INFLOW,
        )
        .order_by("sort_order")
        .first()
        or TransactionCategory.objects.filter(project=project, is_deleted=False)
        .order_by("sort_order")
        .first()
    )
