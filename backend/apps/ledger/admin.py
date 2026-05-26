from django.contrib import admin

from apps.ledger.models import Transaction, TransactionCategory


@admin.register(TransactionCategory)
class TransactionCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "project", "direction_hint", "is_active", "sort_order")
    list_filter = ("project", "direction_hint", "is_active", "is_deleted")
    search_fields = ("name", "slug", "project__name")
    prepopulated_fields = {"slug": ("name",)}
    autocomplete_fields = ("project",)


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "transaction_date",
        "project",
        "amount",
        "direction",
        "status",
        "entry_type",
        "category",
    )
    list_filter = ("status", "direction", "entry_type", "project")
    search_fields = ("description", "reference_no")
    readonly_fields = (
        "voided_at",
        "voided_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )
    autocomplete_fields = ("project", "unit", "owner", "category", "reverses")

    def has_delete_permission(self, request, obj=None):
        return False
