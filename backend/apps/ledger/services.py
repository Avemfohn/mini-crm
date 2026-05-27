from django.db import transaction as db_transaction
from django.utils import timezone

from apps.ledger.models import EntryType, Transaction, TransactionDirection, TransactionStatus


@db_transaction.atomic
def post_transaction(txn: Transaction) -> Transaction:
    if txn.status != TransactionStatus.DRAFT:
        raise ValueError("Only draft transactions can be posted.")
    txn.status = TransactionStatus.ACTIVE
    txn.save()
    return txn


@db_transaction.atomic
def void_transaction(
    txn: Transaction,
    *,
    voided_by,
    void_reason: str = "",
    create_reversal: bool = False,
) -> Transaction:
    if txn.status != TransactionStatus.ACTIVE:
        raise ValueError("Only active transactions can be voided.")

    # Reversal rows offset an already-voided payment; do not chain another reversal.
    if txn.entry_type == EntryType.REVERSAL:
        create_reversal = False

    if create_reversal:
        reversal_direction = (
            TransactionDirection.OUTFLOW
            if txn.direction == TransactionDirection.INFLOW
            else TransactionDirection.INFLOW
        )
        Transaction.objects.create(
            project=txn.project,
            unit=txn.unit,
            owner=txn.owner,
            category=txn.category,
            transaction_date=txn.transaction_date,
            amount=txn.amount,
            direction=reversal_direction,
            description=f"Reversal of {txn.id}",
            reference_no=txn.reference_no,
            status=TransactionStatus.ACTIVE,
            entry_type=EntryType.REVERSAL,
            reverses=txn,
            created_by=voided_by,
        )

    txn.status = TransactionStatus.VOIDED
    txn.voided_at = timezone.now()
    txn.voided_by = voided_by
    txn.void_reason = void_reason
    txn.save()

    return txn
