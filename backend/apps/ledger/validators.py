from django.core.exceptions import ValidationError

from apps.ledger.models import EntryType, TransactionStatus


def validate_reversal_target(transaction) -> None:
    if transaction.entry_type != EntryType.REVERSAL:
        return
    if not transaction.reverses_id:
        raise ValidationError({"reverses": "Reversal entries must reference the original transaction."})
    original = transaction.reverses
    if original.status != TransactionStatus.ACTIVE:
        raise ValidationError({"reverses": "Can only reverse an active transaction."})
