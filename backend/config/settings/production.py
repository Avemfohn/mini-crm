from django.core.exceptions import ImproperlyConfigured

from config.env import env_bool, env_list, env_str

from .base import DEV_SECRET_KEY, SECRET_KEY  # noqa: F401
from .base import *  # noqa: F403

DEBUG = False

INSTALLED_APPS += ["django.contrib.postgres"]  # noqa: F405

# Optional: only used by `seed_data --demo` / `seed_menderes`. Not required for normal use.
DEMO_USER_PASSWORD = env_str("DEMO_USER_PASSWORD")

if not SECRET_KEY or SECRET_KEY == DEV_SECRET_KEY:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be set to a unique value in production."
    )

if DEMO_USER_PASSWORD == "demo1234":
    raise ImproperlyConfigured(
        "DEMO_USER_PASSWORD must not use the default value demo1234 in production. "
        "Leave it unset if you do not run demo seed commands."
    )

# Railway/Vercel sit behind HTTPS reverse proxies.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

_csrf_trusted = env_list("CSRF_TRUSTED_ORIGINS")
if _csrf_trusted:
    CSRF_TRUSTED_ORIGINS = _csrf_trusted
else:
    _origins: set[str] = set(CORS_ALLOWED_ORIGINS)  # noqa: F405
    for host in ALLOWED_HOSTS:  # noqa: F405
        if host in {"localhost", "127.0.0.1", "*"}:
            continue
        _origins.add(f"https://{host}")
    CSRF_TRUSTED_ORIGINS = sorted(_origins)

if env_bool("DJANGO_SECURE_COOKIES", default=False):
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
