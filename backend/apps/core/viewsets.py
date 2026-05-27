from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import (
    get_project_membership,
    get_user_projects,
    user_can_manage_project,
    user_can_write_project,
)
from apps.projects.models import Project


class SoftDeleteQueryMixin:
    """Helpers for admin-only soft-delete visibility and restore."""

    def include_deleted_requested(self):
        return self.request.query_params.get("include_deleted", "").lower() == "true"

    def get_soft_delete_project(self):
        return self.get_project()

    def user_can_manage_deleted(self):
        if not self.request.user.is_authenticated:
            return False
        if self.request.user.is_superuser:
            return True
        project = self.get_soft_delete_project()
        return user_can_manage_project(self.request.user, project)

    def check_include_deleted_permission(self):
        if self.include_deleted_requested() and not self.user_can_manage_deleted():
            raise PermissionDenied("Only project admins can view deleted records.")

    def apply_soft_delete_filter(self, queryset):
        self.check_include_deleted_permission()
        if self.include_deleted_requested() and self.user_can_manage_deleted():
            return queryset
        return queryset.filter(is_deleted=False)

    def get_queryset_for_action(self, base_queryset):
        if getattr(self, "action", None) == "restore":
            return base_queryset
        return self.apply_soft_delete_filter(base_queryset)

    @extend_schema(tags=["projects"], request=None, responses={200: None})
    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        if not self.user_can_manage_deleted():
            raise PermissionDenied("Only project admins can restore deleted records.")
        instance = self.get_object()
        if not instance.is_deleted:
            raise ValidationError("Record is not deleted.")
        instance.restore()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ProjectScopedMixin:
    """Mixin for viewsets nested under /projects/{project_id}/."""

    project_url_kwarg = "project_id"

    def get_project_id(self):
        return self.kwargs[self.project_url_kwarg]

    def get_project(self):
        if not hasattr(self, "_project"):
            project_id = self.get_project_id()
            try:
                self._project = Project.objects.get(id=project_id, is_deleted=False)
            except Project.DoesNotExist as exc:
                raise NotFound("Project not found.") from exc
            if not self.request.user.is_superuser:
                if not get_user_projects(self.request.user).filter(id=project_id).exists():
                    raise PermissionDenied("You do not have access to this project.")
        return self._project

    def get_membership(self):
        return get_project_membership(self.request.user, self.get_project())

    def user_can_write(self):
        if self.request.user.is_superuser:
            return True
        return user_can_write_project(self.request.user, self.get_project())


class AuditedModelViewSetMixin:
    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class SoftDeleteModelViewSetMixin:
    def perform_destroy(self, instance):
        instance.soft_delete()


class ProjectModelViewSet(
    SoftDeleteQueryMixin,
    ProjectScopedMixin,
    AuditedModelViewSetMixin,
    SoftDeleteModelViewSetMixin,
    ModelViewSet,
):
    pass
