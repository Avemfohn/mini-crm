import os
import subprocess
import sys


def test_production_rejects_default_secret_key():
    env = os.environ.copy()
    env["DJANGO_SETTINGS_MODULE"] = "config.settings.production"
    env["DJANGO_SECRET_KEY"] = "django-insecure-dev-only-change-in-production"
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import django; django.setup()",
        ],
        env=env,
        capture_output=True,
        text=True,
        cwd=os.path.join(os.path.dirname(__file__), ".."),
    )
    assert result.returncode != 0
    assert "DJANGO_SECRET_KEY" in result.stderr
