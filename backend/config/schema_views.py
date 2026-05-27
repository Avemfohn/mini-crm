from django.conf import settings
from django.http import Http404
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


class DebugSpectacularAPIView(SpectacularAPIView):
    def dispatch(self, request, *args, **kwargs):
        if not settings.DEBUG:
            raise Http404()
        return super().dispatch(request, *args, **kwargs)


class DebugSpectacularSwaggerView(SpectacularSwaggerView):
    def dispatch(self, request, *args, **kwargs):
        if not settings.DEBUG:
            raise Http404()
        return super().dispatch(request, *args, **kwargs)
