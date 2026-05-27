from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, viewsets
from rest_framework.response import Response

from apps.accounts.models import ProjectMembership, UserProfile
from apps.accounts.serializers import (
    MeSerializer,
    MeUpdateSerializer,
    ProjectMembershipSerializer,
    UserProfileSerializer,
    UserSerializer,
)
from apps.core.permissions import IsProjectAdmin
from apps.core.viewsets import ProjectScopedMixin

User = get_user_model()


@extend_schema(tags=["auth"])
class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MeSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def _build_me_response(self, request):
        profile = UserProfile.objects.filter(user=request.user).first()
        memberships = ProjectMembership.objects.filter(
            user=request.user,
            is_active=True,
        ).select_related("project", "role")
        return {
            "user": UserSerializer(request.user).data,
            "profile": UserProfileSerializer(profile).data if profile else None,
            "memberships": [
                {
                    "id": str(m.id),
                    "project": {
                        "id": str(m.project.id),
                        "name": m.project.name,
                        "code": m.project.code,
                        "status": m.project.status,
                        "currency": m.project.currency,
                    },
                    "role": {
                        "id": m.role.id,
                        "code": m.role.code,
                        "name": m.role.name,
                        "description": m.role.description,
                    },
                    "is_active": m.is_active,
                }
                for m in memberships
            ],
        }

    @extend_schema(responses=MeSerializer)
    def get(self, request, *args, **kwargs):
        return Response(self._build_me_response(request))

    @extend_schema(request=MeUpdateSerializer, responses=MeSerializer)
    def patch(self, request, *args, **kwargs):
        serializer = MeUpdateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if "display_name" in data:
            profile.display_name = data["display_name"]
        if "phone" in data:
            profile.phone = data["phone"]
        if "locale" in data:
            profile.locale = data["locale"]
        profile.save()

        if data.get("new_password"):
            request.user.set_password(data["new_password"])
            request.user.save()

        return Response(self._build_me_response(request))


@extend_schema_view(
    list=extend_schema(tags=["accounts"]),
    create=extend_schema(tags=["accounts"]),
    retrieve=extend_schema(tags=["accounts"]),
    update=extend_schema(tags=["accounts"]),
    partial_update=extend_schema(tags=["accounts"]),
    destroy=extend_schema(tags=["accounts"]),
)
class ProjectMembershipViewSet(ProjectScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProjectMembershipSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectAdmin]

    def get_queryset(self):
        return ProjectMembership.objects.filter(
            project=self.get_project(),
        ).select_related("user", "role", "project").order_by("-created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project"] = self.get_project()
        return context

    def perform_create(self, serializer):
        serializer.save(project=self.get_project())
