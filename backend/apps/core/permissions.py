from django.db.models import Q

from apps.accounts.models import ProjectMembership, RoleCode
from apps.parties.models import Owner, UnitOwnership
from apps.projects.models import Project, Unit


def get_user_projects(user):
    if user.is_superuser:
        return Project.objects.filter(is_deleted=False)
    project_ids = ProjectMembership.objects.filter(
        user=user,
        is_active=True,
    ).values_list("project_id", flat=True)
    return Project.objects.filter(id__in=project_ids, is_deleted=False)


def get_project_membership(user, project):
    if user.is_superuser:
        return None
    return ProjectMembership.objects.filter(
        user=user,
        project=project,
        is_active=True,
    ).select_related("role").first()


def user_has_project_role(user, project, *role_codes):
    if user.is_superuser:
        return True
    membership = get_project_membership(user, project)
    if not membership:
        return False
    return membership.role.code in role_codes


def user_is_project_member(user, project):
    if user.is_superuser:
        return True
    return ProjectMembership.objects.filter(
        user=user,
        project=project,
        is_active=True,
    ).exists()


def get_owner_profile(user):
    if not user.is_authenticated:
        return None
    return Owner.objects.filter(user=user, is_deleted=False).first()


def get_owner_scoped_units(user, project):
    owner = get_owner_profile(user)
    if not owner:
        return Unit.objects.none()
    unit_ids = UnitOwnership.objects.filter(
        owner=owner,
        unit__project=project,
        unit__is_deleted=False,
    ).values_list("unit_id", flat=True)
    return Unit.objects.filter(id__in=unit_ids, is_deleted=False)


def get_owner_scoped_owner_ids(user, project):
    owner = get_owner_profile(user)
    if not owner:
        return []
    unit_ids = get_owner_scoped_units(user, project).values_list("id", flat=True)
    owner_ids = UnitOwnership.objects.filter(
        unit_id__in=unit_ids,
    ).values_list("owner_id", flat=True)
    return list(set(owner_ids) | {owner.id})


class IsProjectMember:
    """User has active membership for the project in the URL."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        project = view.get_project()
        return user_is_project_member(request.user, project)

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class HasProjectRole:
    """Member with role in the allowed set."""

    def __init__(self, *role_codes):
        self.role_codes = role_codes

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        project = view.get_project()
        return user_has_project_role(request.user, project, *self.role_codes)

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class IsProjectAdminOrContractor:
    """Write access for ledger, units, blocks, categories."""

    def has_permission(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return IsProjectMember().has_permission(request, view)
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        project = view.get_project()
        return user_has_project_role(
            request.user, project, RoleCode.ADMIN, RoleCode.CONTRACTOR
        )

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class IsProjectAdmin:
    """Membership management and admin-only operations."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        project = view.get_project()
        return user_has_project_role(request.user, project, RoleCode.ADMIN)

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class IsProjectMemberReadOnlyForOwner:
    """OWNER role gets read-only; ADMIN/CONTRACTOR can write."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        project = view.get_project()
        if not user_is_project_member(request.user, project):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return user_has_project_role(
            request.user, project, RoleCode.ADMIN, RoleCode.CONTRACTOR
        )

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


def filter_queryset_for_owner_role(user, project, queryset, unit_field="unit", owner_field="owner"):
    """Restrict queryset to owner's units/records when user has OWNER role only."""
    if user.is_superuser:
        return queryset
    membership = get_project_membership(user, project)
    if not membership:
        return queryset.none()
    if membership.role.code in (RoleCode.ADMIN, RoleCode.CONTRACTOR):
        return queryset
    owner = get_owner_profile(user)
    if not owner:
        return queryset.none()
    unit_ids = get_owner_scoped_units(user, project).values_list("id", flat=True)
    owner_ids = get_owner_scoped_owner_ids(user, project)
    q = Q()
    if unit_field:
        q |= Q(**{f"{unit_field}_id__in": unit_ids})
    if owner_field:
        q |= Q(**{f"{owner_field}_id__in": owner_ids})
    if not q:
        return queryset.none()
    return queryset.filter(q)
