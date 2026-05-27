import pytest


@pytest.fixture(autouse=True)
def enable_local_test_settings(settings):
    settings.DEBUG = True
    hosts = list(settings.ALLOWED_HOSTS)
    if "testserver" not in hosts:
        settings.ALLOWED_HOSTS = [*hosts, "testserver"]
