from django.core.exceptions import ImproperlyConfigured

from config.env import env_bool

from .base import DEV_SECRET_KEY, SECRET_KEY  # noqa: F401
from .base import *  # noqa: F403

DEBUG = False

INSTALLED_APPS += ["django.contrib.postgres"]  # noqa: F405

if not SECRET_KEY or SECRET_KEY == DEV_SECRET_KEY:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be set to a unique value in production."
    )

if env_bool("DJANGO_SECURE_COOKIES", default=False):
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
