from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import ProjectMembership, Role, UserProfile
from apps.projects.models import Project

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_superuser"]
        read_only_fields = fields


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["display_name", "phone", "locale"]


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "code", "name", "description"]
        read_only_fields = fields


class ProjectSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ["id", "name", "code", "status", "currency"]
        read_only_fields = fields


class ProjectMembershipSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source="role",
        write_only=True,
    )
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="user",
        write_only=True,
    )
    project = ProjectSummarySerializer(read_only=True)

    class Meta:
        model = ProjectMembership
        fields = [
            "id",
            "user",
            "user_id",
            "project",
            "role",
            "role_id",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "created_at", "updated_at"]

    def validate(self, attrs):
        project = self.context.get("project")
        user = attrs.get("user")
        if project and user:
            qs = ProjectMembership.objects.filter(user=user, project=project)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "This user already has a membership for this project."
                )
        return attrs


class MembershipSummarySerializer(serializers.ModelSerializer):
    project = ProjectSummarySerializer(read_only=True)
    role = RoleSerializer(read_only=True)

    class Meta:
        model = ProjectMembership
        fields = ["id", "project", "role", "is_active"]


class MeSerializer(serializers.Serializer):
    user = UserSerializer()
    profile = UserProfileSerializer(allow_null=True)
    memberships = MembershipSummarySerializer(many=True)


class MeUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    locale = serializers.CharField(max_length=10, required=False)
    current_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False, min_length=8)

    def validate(self, attrs):
        current = attrs.get("current_password")
        new = attrs.get("new_password")
        if new and not current:
            raise serializers.ValidationError(
                {"current_password": "Current password is required to set a new password."}
            )
        if current and not new:
            raise serializers.ValidationError(
                {"new_password": "New password is required when changing password."}
            )
        return attrs

    def validate_current_password(self, value):
        user = self.context["request"].user
        if value and not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
