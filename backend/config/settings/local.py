from .base import *  # noqa: F403

DEBUG = True

INSTALLED_APPS += ["django.contrib.postgres"]  # noqa: F405

DATABASES["default"]["HOST"] = os.environ.get("POSTGRES_HOST", "localhost")  # noqa: F405
