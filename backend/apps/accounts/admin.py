from django.contrib import admin

from apps.accounts.models import ProjectMembership, Role, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "display_name", "phone", "locale")
    search_fields = ("user__username", "display_name")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name")
    search_fields = ("code", "name")


@admin.register(ProjectMembership)
class ProjectMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "project", "role", "is_active")
    list_filter = ("role", "is_active", "project")
    search_fields = ("user__username", "project__name")
    autocomplete_fields = ("project",)
