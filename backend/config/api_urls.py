from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.views import MeView, ProjectMembershipViewSet
from apps.ledger.views import PaymentPlanViewSet, TransactionCategoryViewSet, TransactionViewSet
from apps.parties.views import OwnerViewSet, UnitOwnershipViewSet
from apps.projects.views import BlockViewSet, ProjectViewSet, UnitViewSet

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")

nested_routes = [
    ("blocks", BlockViewSet, "block"),
    ("units", UnitViewSet, "unit"),
    ("owners", OwnerViewSet, "owner"),
    ("ownerships", UnitOwnershipViewSet, "ownership"),
    ("categories", TransactionCategoryViewSet, "category"),
    ("transactions", TransactionViewSet, "transaction"),
    ("payment-plans", PaymentPlanViewSet, "payment-plan"),
    ("memberships", ProjectMembershipViewSet, "membership"),
]

restore_routes = [
    ("blocks", BlockViewSet, "block"),
    ("units", UnitViewSet, "unit"),
    ("owners", OwnerViewSet, "owner"),
    ("categories", TransactionCategoryViewSet, "category"),
]

nested_urlpatterns = []
for prefix, viewset, basename in nested_routes:
    nested_urlpatterns.extend([
        path(
            f"projects/<uuid:project_id>/{prefix}/",
            viewset.as_view({"get": "list", "post": "create"}),
            name=f"{basename}-list",
        ),
        path(
            f"projects/<uuid:project_id>/{prefix}/<uuid:pk>/",
            viewset.as_view({
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }),
            name=f"{basename}-detail",
        ),
    ])

for prefix, viewset, basename in restore_routes:
    nested_urlpatterns.append(
        path(
            f"projects/<uuid:project_id>/{prefix}/<uuid:pk>/restore/",
            viewset.as_view({"post": "restore"}),
            name=f"{basename}-restore",
        )
    )

project_restore = [
    path(
        "projects/<uuid:pk>/restore/",
        ProjectViewSet.as_view({"post": "restore"}),
        name="project-restore",
    ),
]

unit_extra = [
    path(
        "projects/<uuid:project_id>/units/<uuid:pk>/owners-at/",
        UnitViewSet.as_view({"get": "owners_at"}),
        name="unit-owners-at",
    ),
    path(
        "projects/<uuid:project_id>/units/<uuid:pk>/set-owner/",
        UnitViewSet.as_view({"post": "set_owner"}),
        name="unit-set-owner",
    ),
]

transaction_extra = [
    path(
        "projects/<uuid:project_id>/transactions/<uuid:pk>/post/",
        TransactionViewSet.as_view({"post": "post"}),
        name="transaction-post",
    ),
    path(
        "projects/<uuid:project_id>/transactions/<uuid:pk>/void/",
        TransactionViewSet.as_view({"post": "void"}),
        name="transaction-void",
    ),
]

urlpatterns = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token-obtain"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("", include(router.urls)),
    *nested_urlpatterns,
    *project_restore,
    *unit_extra,
    *transaction_extra,
]
