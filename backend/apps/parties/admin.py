from django.contrib import admin

from apps.parties.models import Owner, UnitOwnership


class UnitOwnershipInline(admin.TabularInline):
    model = UnitOwnership
    extra = 0
    fields = (
        "unit",
        "effective_from",
        "effective_to",
        "ownership_share",
        "is_primary_contact",
    )
    autocomplete_fields = ("unit",)


@admin.register(Owner)
class OwnerAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "email", "user", "is_deleted")
    list_filter = ("is_deleted",)
    search_fields = ("full_name", "phone", "email", "national_id")
    inlines = [UnitOwnershipInline]


@admin.register(UnitOwnership)
class UnitOwnershipAdmin(admin.ModelAdmin):
    list_display = (
        "owner",
        "unit",
        "effective_from",
        "effective_to",
        "ownership_share",
        "is_primary_contact",
    )
    list_filter = ("effective_from",)
    search_fields = ("owner__full_name", "unit__unit_number")
    autocomplete_fields = ("unit", "owner")
