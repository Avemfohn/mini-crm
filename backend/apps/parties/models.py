from datetime import date
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.core.models import AuditedModel, SoftDeleteModel, TimeStampedModel, UUIDModel
from apps.core.validators import validate_ownership_share
from apps.projects.models import Unit


class Owner(UUIDModel, TimeStampedModel, AuditedModel, SoftDeleteModel):
    full_name = models.CharField(max_length=255)
    national_id = models.CharField(max_length=32, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owner_profiles",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class UnitOwnership(UUIDModel, TimeStampedModel, AuditedModel):
    unit = models.ForeignKey(
        Unit,
        on_delete=models.PROTECT,
        related_name="ownerships",
    )
    owner = models.ForeignKey(
        Owner,
        on_delete=models.PROTECT,
        related_name="unit_ownerships",
    )
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    ownership_share = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=Decimal("1.0000"),
        validators=[validate_ownership_share],
    )
    is_primary_contact = models.BooleanField(default=False)

    class Meta:
        ordering = ["-effective_from"]
        indexes = [
            models.Index(fields=["unit", "effective_from", "effective_to"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(effective_to__isnull=True) | Q(effective_to__gte=models.F("effective_from")),
                name="ownership_effective_to_after_from",
            ),
        ]

    def __str__(self):
        end = self.effective_to.isoformat() if self.effective_to else "present"
        return f"{self.owner} → {self.unit} ({self.effective_from} – {end})"

    def clean(self):
        super().clean()
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValidationError({"effective_to": "End date cannot be before start date."})
        self._validate_no_overlap()

    def _validate_no_overlap(self):
        if not self.unit_id or not self.effective_from:
            return

        period_end = self.effective_to or date.max
        overlapping = UnitOwnership.objects.filter(unit_id=self.unit_id).exclude(pk=self.pk)
        for other in overlapping:
            other_end = other.effective_to or date.max
            if self.effective_from <= other_end and period_end >= other.effective_from:
                raise ValidationError(
                    "Ownership period overlaps with an existing record for this unit."
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
