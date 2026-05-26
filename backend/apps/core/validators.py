from decimal import Decimal

from django.core.exceptions import ValidationError


def validate_ownership_share(value: Decimal) -> None:
    if value <= 0 or value > 1:
        raise ValidationError("Ownership share must be greater than 0 and at most 1.")


def validate_positive_amount(value: Decimal) -> None:
    if value <= 0:
        raise ValidationError("Amount must be greater than zero.")
