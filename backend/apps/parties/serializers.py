from rest_framework import serializers

from apps.parties.models import Owner, UnitOwnership
from apps.projects.models import Unit


class OwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Owner
        fields = [
            "id",
            "full_name",
            "national_id",
            "phone",
            "email",
            "user",
            "notes",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_deleted", "deleted_at", "created_at", "updated_at"]


class UnitOwnershipSerializer(serializers.ModelSerializer):
    owner = OwnerSerializer(read_only=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        queryset=Owner.objects.filter(is_deleted=False),
        source="owner",
        write_only=True,
    )
    unit = serializers.PrimaryKeyRelatedField(read_only=True)
    unit_id = serializers.PrimaryKeyRelatedField(
        queryset=Unit.objects.none(),
        source="unit",
        write_only=True,
    )

    class Meta:
        model = UnitOwnership
        fields = [
            "id",
            "unit",
            "unit_id",
            "owner",
            "owner_id",
            "effective_from",
            "effective_to",
            "ownership_share",
            "is_primary_contact",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "unit", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        project = self.context.get("project")
        if project:
            self.fields["unit_id"].queryset = Unit.objects.filter(
                project=project,
                is_deleted=False,
            )

    def validate(self, attrs):
        unit = attrs.get("unit", getattr(self.instance, "unit", None))
        project = self.context.get("project")
        if unit and project and unit.project_id != project.id:
            raise serializers.ValidationError({"unit": "Unit must belong to this project."})
        return attrs
