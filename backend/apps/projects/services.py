from django.conf import settings
from django.contrib.auth import get_user_model

from apps.accounts.models import ProjectMembership, Role, RoleCode
from apps.projects.models import Unit

User = get_user_model()


def active_units_for_project(project):
    return Unit.objects.filter(project=project, is_deleted=False)


def sync_family_memberships(project) -> int:
    """
    Give every active user Müteahhit on this project (family/shared access mode).
    Returns number of memberships created (not updated).
    """
    if not getattr(settings, "SHARED_PROJECT_ACCESS", False):
        return 0
    contractor = Role.objects.get(code=RoleCode.CONTRACTOR)
    count = 0
    for user in User.objects.filter(is_active=True):
        membership, created = ProjectMembership.objects.get_or_create(
            user=user,
            project=project,
            defaults={"role": contractor, "is_active": True},
        )
        if created:
            count += 1
            continue
        # Never downgrade Yönetici (or other roles); only ensure access is active.
        if not membership.is_active:
            membership.is_active = True
            membership.save(update_fields=["is_active"])
    return count


def sync_all_family_memberships() -> int:
    from apps.projects.models import Project

    total = 0
    for project in Project.objects.filter(is_deleted=False):
        total += sync_family_memberships(project)
    return total
