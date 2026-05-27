from apps.ledger.models import DirectionHint, TransactionCategory
from apps.projects.models import Block, Project

DEFAULT_CATEGORIES = [
    ("Ödeme", DirectionHint.INFLOW, "odeme", 0),
    ("Çimento", DirectionHint.OUTFLOW, "cimento", 10),
    ("Demir", DirectionHint.OUTFLOW, "demir", 20),
    ("İşçilik", DirectionHint.OUTFLOW, "iscilik", 30),
    ("Nakliye", DirectionHint.OUTFLOW, "nakliye", 40),
    ("Genel gider", DirectionHint.OUTFLOW, "genel-gider", 50),
]


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
    for name, direction_hint, slug, sort_order in DEFAULT_CATEGORIES:
        TransactionCategory.objects.update_or_create(
            project=project,
            slug=slug,
            defaults={
                "name": name,
                "direction_hint": direction_hint,
                "sort_order": sort_order,
                "is_active": True,
                "is_deleted": False,
                "deleted_at": None,
            },
        )


def setup_new_project(project: Project, user) -> None:
    create_default_block(project, user)
    seed_default_categories(project)
