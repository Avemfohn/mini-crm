from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import AuditedModel, SoftDeleteModel, TimeStampedModel, UUIDModel
from apps.core.validators import validate_positive_amount
from apps.parties.models import Owner
from apps.projects.models import Project, Unit


class DirectionHint(models.TextChoices):
    INFLOW = "INFLOW", "Inflow"
    OUTFLOW = "OUTFLOW", "Outflow"
    EITHER = "EITHER", "Either"


class TransactionDirection(models.TextChoices):
    INFLOW = "INFLOW", "Inflow"
    OUTFLOW = "OUTFLOW", "Outflow"


class TransactionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    ACTIVE = "ACTIVE", "Active"
    VOIDED = "VOIDED", "Voided"


class EntryType(models.TextChoices):
    STANDARD = "STANDARD", "Standard"
    REVERSAL = "REVERSAL", "Reversal"


IMMUTABLE_WHEN_ACTIVE = frozenset({
    "project_id",
    "unit_id",
    "owner_id",
    "category_id",
    "transaction_date",
    "amount",
    "direction",
    "entry_type",
})


class TransactionQuerySet(models.QuerySet):
    def active(self):
        return self.filter(status=TransactionStatus.ACTIVE)

    def voided(self):
        return self.filter(status=TransactionStatus.VOIDED)


class TransactionManager(models.Manager):
    def get_queryset(self):
        return TransactionQuerySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()


class TransactionCategory(UUIDModel, TimeStampedModel, SoftDeleteModel):
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="transaction_categories",
    )
    name = models.CharField(max_length=128)
    slug = models.SlugField(max_length=64)
    direction_hint = models.CharField(
        max_length=10,
        choices=DirectionHint.choices,
        default=DirectionHint.EITHER,
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "slug"],
                condition=Q(is_deleted=False),
                name="uniq_category_slug_per_project_active",
            ),
        ]

    def __str__(self):
        return f"{self.project.code} / {self.name}"


class Transaction(UUIDModel, TimeStampedModel, AuditedModel):
    EntryType = EntryType

    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    unit = models.ForeignKey(
        Unit,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="transactions",
    )
    owner = models.ForeignKey(
        Owner,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="transactions",
    )
    category = models.ForeignKey(
        TransactionCategory,
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    transaction_date = models.DateField()
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[validate_positive_amount],
    )
    direction = models.CharField(max_length=10, choices=TransactionDirection.choices)
    description = models.TextField(blank=True)
    reference_no = models.CharField(max_length=128, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    status = models.CharField(
        max_length=10,
        choices=TransactionStatus.choices,
        default=TransactionStatus.DRAFT,
    )
    entry_type = models.CharField(
        max_length=10,
        choices=EntryType.choices,
        default=EntryType.STANDARD,
    )
    reverses = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reversal_entries",
    )
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="voided_transactions",
    )
    void_reason = models.TextField(blank=True)
    idempotency_key = models.CharField(max_length=64, null=True, blank=True)

    objects = TransactionManager()

    class Meta:
        ordering = ["-transaction_date", "-created_at"]
        indexes = [
            models.Index(fields=["project", "transaction_date"]),
            models.Index(fields=["project", "status"]),
            models.Index(fields=["unit", "transaction_date"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(amount__gt=0),
                name="transaction_amount_positive",
            ),
            models.CheckConstraint(
                check=~Q(status=TransactionStatus.VOIDED) | Q(voided_at__isnull=False),
                name="voided_requires_voided_at",
            ),
            models.UniqueConstraint(
                fields=["project", "idempotency_key"],
                condition=Q(idempotency_key__isnull=False),
                name="uniq_idempotency_key_per_project",
            ),
        ]

    def __str__(self):
        return f"{self.transaction_date} {self.direction} {self.amount} ({self.status})"

    def clean(self):
        super().clean()
        if self.unit_id and self.project_id and self.unit.project_id != self.project_id:
            raise ValidationError({"unit": "Unit must belong to the same project."})
        if self.category_id and self.project_id and self.category.project_id != self.project_id:
            raise ValidationError({"category": "Category must belong to the same project."})
        if self.entry_type == EntryType.REVERSAL:
            if not self.reverses_id:
                raise ValidationError({"reverses": "Reversal entries must reference the original transaction."})
            elif self.reverses.status != TransactionStatus.ACTIVE:
                raise ValidationError({"reverses": "Can only reverse an active transaction."})
        if self.status == TransactionStatus.VOIDED and not self.voided_at:
            raise ValidationError({"voided_at": "Voided transactions must have voided_at set."})

    def _enforce_immutability(self):
        if not self.pk:
            return
        old = Transaction.objects.get(pk=self.pk)
        if old.status != TransactionStatus.ACTIVE:
            return
        for field in IMMUTABLE_WHEN_ACTIVE:
            if getattr(old, field) != getattr(self, field):
                raise ValidationError("Posted transactions are immutable.")

    def save(self, *args, **kwargs):
        self._enforce_immutability()
        if self.status == TransactionStatus.VOIDED and not self.voided_at:
            self.voided_at = timezone.now()
        self.full_clean()
        super().save(*args, **kwargs)

    def delete(self, using=None, keep_parents=False):
        raise ValidationError("Transactions cannot be deleted. Void the transaction instead.")

    def delete_queryset(self):
        raise ValidationError("Transactions cannot be deleted.")
