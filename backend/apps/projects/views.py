from datetime import date, timedelta
from decimal import Decimal

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import ProjectMembership, Role, RoleCode
from apps.core.permissions import (
    get_owner_scoped_units,
    get_user_projects,
    user_has_project_role,
)
from apps.core.viewsets import ProjectModelViewSet, SoftDeleteQueryMixin
from apps.parties.models import Owner, UnitOwnership
from apps.projects.models import Block, Project, Unit
from apps.projects.serializers import BlockSerializer, ProjectSerializer, UnitSerializer
from apps.projects.setup import setup_new_project


class SetOwnerSerializer(serializers.Serializer):
    owner_id = serializers.UUIDField()
    effective_from = serializers.DateField(required=False)


class IsProjectWriter(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True
        if request.method in permissions.SAFE_METHODS:
            return get_user_projects(request.user).filter(id=obj.id).exists()
        return user_has_project_role(
            request.user, obj, RoleCode.ADMIN, RoleCode.CONTRACTOR
        )


@extend_schema_view(
    list=extend_schema(tags=["projects"]),
    create=extend_schema(tags=["projects"]),
    retrieve=extend_schema(tags=["projects"]),
    update=extend_schema(tags=["projects"]),
    partial_update=extend_schema(tags=["projects"]),
    destroy=extend_schema(tags=["projects"]),
    restore=extend_schema(tags=["projects"], request=None),
)
class ProjectViewSet(SoftDeleteQueryMixin, viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectWriter]

    def get_soft_delete_project(self):
        pk = self.kwargs.get("pk")
        if pk and self.action in ("retrieve", "update", "partial_update", "destroy", "restore"):
            return Project.objects.filter(id=pk).first()
        return None

    def get_queryset(self):
        self.check_include_deleted_permission()
        active = get_user_projects(self.request.user)
        if self.include_deleted_requested() and self.user_can_manage_deleted():
            if self.request.user.is_superuser:
                return Project.objects.all().order_by("name")
            admin_project_ids = ProjectMembership.objects.filter(
                user=self.request.user,
                role__code=RoleCode.ADMIN,
                is_active=True,
            ).values_list("project_id", flat=True)
            deleted_admin = Project.objects.filter(id__in=admin_project_ids, is_deleted=True)
            return (active | deleted_admin).distinct().order_by("name")
        return active

    def get_object(self):
        if self.action == "restore":
            if self.request.user.is_superuser:
                queryset = Project.objects.all()
            else:
                admin_project_ids = ProjectMembership.objects.filter(
                    user=self.request.user,
                    role__code=RoleCode.ADMIN,
                    is_active=True,
                ).values_list("project_id", flat=True)
                queryset = Project.objects.filter(id__in=admin_project_ids)
        else:
            queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        obj = queryset.get(**filter_kwargs)
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        project = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        admin_role = Role.objects.get(code=RoleCode.ADMIN)
        ProjectMembership.objects.create(
            user=self.request.user,
            project=project,
            role=admin_role,
            is_active=True,
        )
        setup_new_project(project, self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        instance.soft_delete()


@extend_schema_view(
    list=extend_schema(tags=["projects"]),
    create=extend_schema(tags=["projects"]),
    retrieve=extend_schema(tags=["projects"]),
    update=extend_schema(tags=["projects"]),
    partial_update=extend_schema(tags=["projects"]),
    destroy=extend_schema(tags=["projects"]),
    restore=extend_schema(tags=["projects"], request=None),
)
class BlockViewSet(ProjectModelViewSet):
    serializer_class = BlockSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        from apps.core.permissions import IsProjectAdminOrContractor

        return [permissions.IsAuthenticated(), IsProjectAdminOrContractor()]

    def get_queryset(self):
        qs = Block.objects.filter(project=self.get_project()).order_by("sort_order", "name")
        return self.get_queryset_for_action(qs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project"] = self.get_project()
        return context


@extend_schema_view(
    list=extend_schema(tags=["projects"]),
    create=extend_schema(tags=["projects"]),
    retrieve=extend_schema(tags=["projects"]),
    update=extend_schema(tags=["projects"]),
    partial_update=extend_schema(tags=["projects"]),
    destroy=extend_schema(tags=["projects"]),
    restore=extend_schema(tags=["projects"], request=None),
    owners_at=extend_schema(tags=["parties"]),
    set_owner=extend_schema(tags=["parties"]),
)
class UnitViewSet(ProjectModelViewSet):
    serializer_class = UnitSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        from apps.core.permissions import IsProjectMemberReadOnlyForOwner

        return [permissions.IsAuthenticated(), IsProjectMemberReadOnlyForOwner()]

    def get_queryset(self):
        qs = Unit.objects.filter(project=self.get_project()).select_related("block").order_by("unit_number")
        if not self.request.user.is_superuser:
            membership = self.get_membership()
            if membership and membership.role.code == RoleCode.OWNER:
                unit_ids = get_owner_scoped_units(
                    self.request.user, self.get_project()
                ).values_list("id", flat=True)
                qs = qs.filter(id__in=unit_ids)
        return self.get_queryset_for_action(qs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project"] = self.get_project()
        return context

    @action(detail=True, methods=["get"], url_path="owners-at")
    def owners_at(self, request, project_id=None, pk=None):
        from datetime import datetime

        from apps.parties.serializers import UnitOwnershipSerializer
        from apps.parties.services import owners_at

        unit = self.get_object()
        date_str = request.query_params.get("date")
        as_of = None
        if date_str:
            try:
                as_of = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError as exc:
                raise ValidationError({"date": "Use YYYY-MM-DD format."}) from exc
        ownerships = owners_at(unit, as_of)
        serializer = UnitOwnershipSerializer(ownerships, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="set-owner",
        permission_classes=[permissions.IsAuthenticated],
    )
    def set_owner(self, request, project_id=None, pk=None):
        from apps.core.permissions import IsProjectAdminOrContractor

        perm = IsProjectAdminOrContractor()
        if not perm.has_permission(request, self) or not perm.has_object_permission(
            request, self, self.get_object()
        ):
            return Response(status=status.HTTP_403_FORBIDDEN)

        unit = self.get_object()
        body = SetOwnerSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        effective_from = body.validated_data.get("effective_from") or date.today()
        owner = Owner.objects.get(id=body.validated_data["owner_id"], is_deleted=False)

        open_ownerships = UnitOwnership.objects.filter(unit=unit, effective_to__isnull=True)
        for ownership in open_ownerships:
            end = effective_from - timedelta(days=1)
            if end < ownership.effective_from:
                end = ownership.effective_from
            ownership.effective_to = end
            ownership.updated_by = request.user
            ownership.save()

        ownership = UnitOwnership.objects.create(
            unit=unit,
            owner=owner,
            effective_from=effective_from,
            ownership_share=Decimal("1.0000"),
            is_primary_contact=True,
            created_by=request.user,
            updated_by=request.user,
        )
        from apps.parties.serializers import UnitOwnershipSerializer

        return Response(
            UnitOwnershipSerializer(ownership).data,
            status=status.HTTP_201_CREATED,
        )
