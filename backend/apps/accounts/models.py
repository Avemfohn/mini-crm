from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel, UUIDModel
from apps.projects.models import Project


class RoleCode(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    CONTRACTOR = "CONTRACTOR", "Contractor"
    OWNER = "OWNER", "Owner"


class UserProfile(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    display_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    locale = models.CharField(max_length=10, default="tr")

    def __str__(self):
        return self.display_name or self.user.get_username()


class Role(models.Model):
    code = models.CharField(max_length=32, choices=RoleCode.choices, unique=True)
    name = models.CharField(max_length=64)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.name


class ProjectMembership(UUIDModel, TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="memberships",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "project"],
                name="uniq_user_project_membership",
            ),
        ]

    def __str__(self):
        return f"{self.user} @ {self.project} ({self.role})"
