from config.env import env_list

from .base import *  # noqa: F403

DEBUG = True

INSTALLED_APPS += ["django.contrib.postgres"]  # noqa: F405

if not CORS_ALLOWED_ORIGINS:  # noqa: F405
    CORS_ALLOWED_ORIGINS = env_list(  # noqa: F405
        "CORS_ALLOWED_ORIGINS",
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
    )

ALLOWED_HOSTS = [*ALLOWED_HOSTS, "testserver"]  # noqa: F405
