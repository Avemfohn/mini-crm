from datetime import date

from django.db.models import Q

from apps.parties.models import UnitOwnership


def owners_at(unit, as_of: date | None = None):
    """Return ownership rows active on the given date (default: today)."""
    as_of = as_of or date.today()
    return UnitOwnership.objects.filter(
        unit=unit,
        effective_from__lte=as_of,
    ).filter(
        Q(effective_to__isnull=True) | Q(effective_to__gte=as_of)
    ).select_related("owner")
