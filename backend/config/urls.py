from django.contrib import admin
from django.urls import include, path

from config.schema_views import DebugSpectacularAPIView, DebugSpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("config.api_urls")),
    path("api/v1/schema/", DebugSpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/docs/",
        DebugSpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
