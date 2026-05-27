from apps.ledger.models import DirectionHint, TransactionCategory
from apps.projects.models import Block, Project

DEFAULT_PAYMENT_CATEGORY = ("Ödeme", DirectionHint.INFLOW, "odeme")


def create_default_block(project: Project, user) -> Block:
    return Block.objects.create(
        project=project,
        name="Ana Blok",
        code="A",
        sort_order=0,
        created_by=user,
        updated_by=user,
    )


def seed_default_categories(project: Project) -> None:
    name, direction_hint, slug = DEFAULT_PAYMENT_CATEGORY
    TransactionCategory.objects.update_or_create(
        project=project,
        slug=slug,
        defaults={
            "name": name,
            "direction_hint": direction_hint,
            "sort_order": 0,
            "is_active": True,
        },
    )


def setup_new_project(project: Project, user) -> None:
    create_default_block(project, user)
    seed_default_categories(project)
