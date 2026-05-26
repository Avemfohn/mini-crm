from django.contrib import admin

from apps.projects.models import Block, Project, Unit


class BlockInline(admin.TabularInline):
    model = Block
    extra = 0
    fields = ("name", "code", "sort_order", "is_deleted")


class UnitInline(admin.TabularInline):
    model = Unit
    extra = 0
    fields = ("block", "unit_number", "floor", "status", "is_deleted")


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "status", "currency", "is_deleted", "created_at")
    list_filter = ("status", "is_deleted")
    search_fields = ("name", "code")
    prepopulated_fields = {"code": ("name",)}
    inlines = [BlockInline, UnitInline]


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "project", "sort_order", "is_deleted")
    list_filter = ("project", "is_deleted")
    search_fields = ("name", "code", "project__name")


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ("unit_number", "project", "block", "floor", "status", "is_deleted")
    list_filter = ("project", "status", "is_deleted")
    search_fields = ("unit_number", "project__name", "block__name")
    autocomplete_fields = ("project", "block")
