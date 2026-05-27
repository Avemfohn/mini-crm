from rest_framework import serializers

from apps.projects.models import Block, Project, Unit


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "code",
            "address",
            "description",
            "currency",
            "status",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_deleted", "deleted_at", "created_at", "updated_at"]


class BlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = Block
        fields = [
            "id",
            "project",
            "name",
            "code",
            "sort_order",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "is_deleted", "deleted_at", "created_at", "updated_at"]

    def validate(self, attrs):
        project = self.context.get("project")
        block = attrs.get("block")
        if block and project and block.project_id != project.id:
            raise serializers.ValidationError({"block": "Block must belong to the same project."})
        return attrs

    def create(self, validated_data):
        validated_data["project"] = self.context["project"]
        return super().create(validated_data)


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = [
            "id",
            "project",
            "block",
            "unit_number",
            "floor",
            "floor_label",
            "position_on_floor",
            "is_roof_level",
            "gross_area_m2",
            "notes",
            "status",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "is_deleted", "deleted_at", "created_at", "updated_at"]

    def validate(self, attrs):
        project = self.context.get("project")
        block = attrs.get("block", getattr(self.instance, "block", None))
        if block and project and block.project_id != project.id:
            raise serializers.ValidationError({"block": "Block must belong to the same project."})
        position = attrs.get(
            "position_on_floor",
            getattr(self.instance, "position_on_floor", None),
        )
        if position is not None and position not in (1, 2):
            raise serializers.ValidationError(
                {"position_on_floor": "Position must be 1 (left) or 2 (right)."}
            )
        floor = attrs.get("floor", getattr(self.instance, "floor", None))
        is_roof = attrs.get(
            "is_roof_level",
            getattr(self.instance, "is_roof_level", False),
        )
        if is_roof and floor is None:
            attrs["floor"] = 99
            floor = 99
        if is_roof:
            attrs["floor_label"] = ""
        elif "floor_label" in attrs:
            attrs["floor_label"] = ""

        if (
            position is not None
            and floor is not None
            and block
            and project
        ):
            qs = Unit.objects.filter(
                project=project,
                block=block,
                floor=floor,
                position_on_floor=position,
                is_deleted=False,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "position_on_floor": (
                            "Another unit already occupies this position on this floor."
                        )
                    }
                )
        return attrs

    def create(self, validated_data):
        validated_data["project"] = self.context["project"]
        return super().create(validated_data)
