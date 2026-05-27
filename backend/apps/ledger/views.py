from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.permissions import (
    IsProjectAdminOrContractor,
    IsProjectMemberReadOnlyForOwner,
    filter_queryset_for_owner_role,
)
from apps.core.viewsets import ProjectModelViewSet, ProjectScopedMixin
from apps.ledger.models import (
    PaymentPlan,
    Transaction,
    TransactionCategory,
    TransactionDirection,
    TransactionStatus,
)
from apps.ledger.serializers import (
    PaymentPlanSerializer,
    TransactionCategorySerializer,
    TransactionSerializer,
)
from apps.ledger.services import post_transaction, void_transaction
from rest_framework import viewsets


@extend_schema_view(
    list=extend_schema(tags=["ledger"]),
    create=extend_schema(tags=["ledger"]),
    retrieve=extend_schema(tags=["ledger"]),
    update=extend_schema(tags=["ledger"]),
    partial_update=extend_schema(tags=["ledger"]),
    destroy=extend_schema(tags=["ledger"]),
    restore=extend_schema(tags=["ledger"], request=None),
)
class TransactionCategoryViewSet(ProjectModelViewSet):
    serializer_class = TransactionCategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectAdminOrContractor]

    def get_queryset(self):
        return self.get_queryset_for_action(
            TransactionCategory.objects.filter(
                project=self.get_project(),
            ).order_by("sort_order", "name")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project"] = self.get_project()
        return context


@extend_schema_view(
    list=extend_schema(tags=["ledger"]),
    create=extend_schema(tags=["ledger"]),
    retrieve=extend_schema(tags=["ledger"]),
    update=extend_schema(tags=["ledger"]),
    partial_update=extend_schema(tags=["ledger"]),
    destroy=extend_schema(tags=["ledger"]),
)
class TransactionViewSet(ProjectScopedMixin, viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberReadOnlyForOwner]

    def get_queryset(self):
        qs = Transaction.objects.filter(
            project=self.get_project(),
        ).select_related("unit", "owner", "category").order_by("-transaction_date", "-created_at")

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        unit_id = self.request.query_params.get("unit")
        if unit_id:
            qs = qs.filter(unit_id=unit_id)
        owner_id = self.request.query_params.get("owner")
        if owner_id:
            qs = qs.filter(owner_id=owner_id)
        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(transaction_date__gte=date_from)
        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(transaction_date__lte=date_to)
        direction_param = self.request.query_params.get("direction")
        if direction_param:
            allowed = {d.value for d in TransactionDirection}
            if direction_param not in allowed:
                raise ValidationError({"direction": "Must be INFLOW or OUTFLOW."})
            qs = qs.filter(direction=direction_param)

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
        if serializer.instance.status != TransactionStatus.DRAFT:
            raise ValidationError("Only draft transactions can be updated.")
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Transactions cannot be deleted. Void instead."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @extend_schema(tags=["ledger"], request=None)
    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsProjectAdminOrContractor])
    def post(self, request, project_id=None, pk=None):
        txn = self.get_object()
        try:
            post_transaction(txn)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        txn.refresh_from_db()
        serializer = self.get_serializer(txn)
        return Response(serializer.data)

    @extend_schema(tags=["ledger"])
    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsProjectAdminOrContractor])
    def void(self, request, project_id=None, pk=None):
        txn = self.get_object()
        void_reason = request.data.get("void_reason", "")
        create_reversal = request.data.get("create_reversal", False)
        try:
            void_transaction(
                txn,
                voided_by=request.user,
                void_reason=void_reason,
                create_reversal=create_reversal,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        serializer = self.get_serializer(txn)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(tags=["ledger"]),
    create=extend_schema(tags=["ledger"]),
    retrieve=extend_schema(tags=["ledger"]),
    update=extend_schema(tags=["ledger"]),
    partial_update=extend_schema(tags=["ledger"]),
    destroy=extend_schema(tags=["ledger"]),
)
class PaymentPlanViewSet(ProjectScopedMixin, viewsets.ModelViewSet):
    serializer_class = PaymentPlanSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectAdminOrContractor]

    def get_queryset(self):
        qs = PaymentPlan.objects.filter(
            project=self.get_project(),
        ).select_related("unit", "owner").order_by("-created_at")
        unit_id = self.request.query_params.get("unit")
        if unit_id:
            qs = qs.filter(unit_id=unit_id)
        owner_id = self.request.query_params.get("owner")
        if owner_id:
            qs = qs.filter(owner_id=owner_id)
        return qs

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
