from apps.projects.models import Unit


def active_units_for_project(project):
    return Unit.objects.filter(project=project, is_deleted=False)
