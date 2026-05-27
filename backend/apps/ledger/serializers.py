from rest_framework import serializers

from apps.ledger.models import (
    IMMUTABLE_WHEN_ACTIVE,
    PaymentPlan,
    Transaction,
    TransactionCategory,
    TransactionStatus,
)
from apps.ledger.payment_plan_services import build_payment_schedule, get_default_category
from apps.parties.models import Owner
from apps.parties.serializers import OwnerSerializer
from apps.projects.models import Unit
from apps.projects.serializers import UnitSerializer


class TransactionCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionCategory
        fields = [
            "id",
            "project",
            "name",
            "slug",
            "direction_hint",
            "is_active",
            "sort_order",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "is_deleted", "deleted_at", "created_at", "updated_at"]

    def create(self, validated_data):
        validated_data["project"] = self.context["project"]
        return super().create(validated_data)


class PaymentPlanSerializer(serializers.ModelSerializer):
    owner = OwnerSerializer(read_only=True)
    unit = UnitSerializer(read_only=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        queryset=Owner.objects.filter(is_deleted=False),
        source="owner",
        write_only=True,
    )
    unit_id = serializers.PrimaryKeyRelatedField(
        queryset=Unit.objects.none(),
        source="unit",
        write_only=True,
    )
    monthly_amount = serializers.SerializerMethodField()
    schedule = serializers.SerializerMethodField()

    class Meta:
        model = PaymentPlan
        fields = [
            "id",
            "project",
            "unit",
            "unit_id",
            "owner",
            "owner_id",
            "total_amount",
            "installment_count",
            "start_date",
            "notes",
            "monthly_amount",
            "schedule",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "monthly_amount", "schedule", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        project = self.context.get("project")
        if project:
            self.fields["unit_id"].queryset = Unit.objects.filter(
                project=project,
                is_deleted=False,
            )

    def get_monthly_amount(self, obj):
        return str(obj.monthly_amount)

    def get_schedule(self, obj):
        return build_payment_schedule(obj)

    def validate(self, attrs):
        project = self.context.get("project")
        unit = attrs.get("unit", getattr(self.instance, "unit", None))
        if unit and project and unit.project_id != project.id:
            raise serializers.ValidationError({"unit": "Unit must belong to this project."})
        return attrs

    def create(self, validated_data):
        validated_data["project"] = self.context["project"]
        return super().create(validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=TransactionCategory.objects.all(),
        required=False,
        allow_null=True,
    )

    @staticmethod
    def _single_instance(instance):
        if instance is None or isinstance(instance, (list, tuple)):
            return None
        return instance

    class Meta:
        model = Transaction
        fields = [
            "id",
            "project",
            "unit",
            "owner",
            "category",
            "transaction_date",
            "amount",
            "direction",
            "description",
            "reference_no",
            "metadata",
            "status",
            "entry_type",
            "reverses",
            "voided_at",
            "voided_by",
            "void_reason",
            "idempotency_key",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "status",
            "entry_type",
            "reverses",
            "voided_at",
            "voided_by",
            "void_reason",
            "created_at",
            "updated_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        project = self.context.get("project")
        if project:
            self.fields["unit"].queryset = Unit.objects.filter(
                project=project,
                is_deleted=False,
            )
            self.fields["owner"].queryset = Owner.objects.filter(is_deleted=False)
            self.fields["category"].queryset = TransactionCategory.objects.filter(
                project=project,
                is_deleted=False,
            )
        instance = self._single_instance(self.instance)
        if instance and instance.status != TransactionStatus.DRAFT:
            for field_name in IMMUTABLE_WHEN_ACTIVE:
                api_field = field_name.replace("_id", "")
                if api_field in self.fields:
                    self.fields[api_field].read_only = True

    def validate(self, attrs):
        project = self.context.get("project")
        instance = self._single_instance(self.instance)
        unit = attrs.get("unit", getattr(instance, "unit", None))
        category = attrs.get("category", getattr(instance, "category", None))
        if unit and project and unit.project_id != project.id:
            raise serializers.ValidationError({"unit": "Unit must belong to this project."})
        if category and project and category.project_id != project.id:
            raise serializers.ValidationError({"category": "Category must belong to this project."})
        if instance and instance.status != TransactionStatus.DRAFT:
            for field_name in IMMUTABLE_WHEN_ACTIVE:
                api_field = field_name.replace("_id", "")
                if api_field in attrs:
                    raise serializers.ValidationError(
                        "Posted transactions are immutable."
                    )
        return attrs

    def create(self, validated_data):
        project = self.context["project"]
        validated_data["project"] = project
        if not validated_data.get("category"):
            category = get_default_category(project)
            if not category:
                raise serializers.ValidationError(
                    {"category": "No default payment category for this project."}
                )
            validated_data["category"] = category
        return super().create(validated_data)
