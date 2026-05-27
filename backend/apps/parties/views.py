from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions

from apps.accounts.models import RoleCode
from apps.core.permissions import (
    IsProjectMemberReadOnlyForOwner,
    filter_queryset_for_owner_role,
    get_owner_scoped_owner_ids,
)
from apps.core.viewsets import ProjectModelViewSet
from apps.parties.models import Owner, UnitOwnership
from apps.parties.serializers import OwnerSerializer, UnitOwnershipSerializer


@extend_schema_view(
    list=extend_schema(tags=["parties"]),
    create=extend_schema(tags=["parties"]),
    retrieve=extend_schema(tags=["parties"]),
    update=extend_schema(tags=["parties"]),
    partial_update=extend_schema(tags=["parties"]),
    destroy=extend_schema(tags=["parties"]),
    restore=extend_schema(tags=["parties"], request=None),
)
class OwnerViewSet(ProjectModelViewSet):
    serializer_class = OwnerSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberReadOnlyForOwner]

    def get_queryset(self):
        qs = Owner.objects.filter(
            unit_ownerships__unit__project=self.get_project(),
        ).distinct().order_by("full_name")
        if not self.request.user.is_superuser:
            membership = self.get_membership()
            if membership and membership.role.code == RoleCode.OWNER:
                owner_ids = get_owner_scoped_owner_ids(
                    self.request.user, self.get_project()
                )
                qs = qs.filter(id__in=owner_ids)
        return self.get_queryset_for_action(qs)


@extend_schema_view(
    list=extend_schema(tags=["parties"]),
    create=extend_schema(tags=["parties"]),
    retrieve=extend_schema(tags=["parties"]),
    update=extend_schema(tags=["parties"]),
    partial_update=extend_schema(tags=["parties"]),
    destroy=extend_schema(tags=["parties"]),
)
class UnitOwnershipViewSet(ProjectModelViewSet):
    serializer_class = UnitOwnershipSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberReadOnlyForOwner]

    def get_queryset(self):
        qs = UnitOwnership.objects.filter(
            unit__project=self.get_project(),
            unit__is_deleted=False,
        ).select_related("owner", "unit").order_by("-effective_from")
        return filter_queryset_for_owner_role(
            self.request.user,
            self.get_project(),
            qs,
            unit_field="unit",
            owner_field="owner",
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project"] = self.get_project()
        return context

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
