from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.core.models import AuditedModel, SoftDeleteModel, TimeStampedModel, UUIDModel


class ProjectStatus(models.TextChoices):
    PLANNING = "PLANNING", "Planning"
    ACTIVE = "ACTIVE", "Active"
    COMPLETED = "COMPLETED", "Completed"
    ARCHIVED = "ARCHIVED", "Archived"


class Project(UUIDModel, TimeStampedModel, AuditedModel, SoftDeleteModel):
    name = models.CharField(max_length=255)
    code = models.SlugField(max_length=64)
    address = models.TextField(blank=True)
    description = models.TextField(blank=True)
    currency = models.CharField(max_length=3, default="TRY")
    status = models.CharField(
        max_length=20,
        choices=ProjectStatus.choices,
        default=ProjectStatus.PLANNING,
    )

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["code"],
                condition=Q(is_deleted=False),
                name="uniq_project_code_active",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Block(UUIDModel, TimeStampedModel, AuditedModel, SoftDeleteModel):
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="blocks",
    )
    name = models.CharField(max_length=255)
    code = models.SlugField(max_length=64)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "code"],
                condition=Q(is_deleted=False),
                name="uniq_block_code_per_project_active",
            ),
        ]

    def __str__(self):
        return f"{self.project.code} / {self.name}"


class UnitStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    ASSIGNED = "ASSIGNED", "Assigned"
    DELIVERED = "DELIVERED", "Delivered"


class Unit(UUIDModel, TimeStampedModel, AuditedModel, SoftDeleteModel):
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="units",
    )
    block = models.ForeignKey(
        Block,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="units",
    )
    unit_number = models.CharField(max_length=64)
    floor = models.IntegerField(null=True, blank=True)
    gross_area_m2 = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=UnitStatus.choices,
        default=UnitStatus.AVAILABLE,
    )

    class Meta:
        ordering = ["unit_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "block", "unit_number"],
                condition=Q(is_deleted=False),
                name="uniq_unit_number_per_block_active",
            ),
        ]

    def clean(self):
        super().clean()
        if self.block_id and self.project_id and self.block.project_id != self.project_id:
            raise ValidationError({"block": "Block must belong to the same project."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        block_label = self.block.code if self.block else "-"
        return f"{self.project.code} / {block_label} / {self.unit_number}"
