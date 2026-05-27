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
        return attrs

    def create(self, validated_data):
        validated_data["project"] = self.context["project"]
        return super().create(validated_data)
