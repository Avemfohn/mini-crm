from django.db import migrations


def seed_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    roles = [
        ("ADMIN", "Yönetici", "Tam yetki"),
        ("CONTRACTOR", "Müteahhit", "Günlük işlemler ve kayıtlar"),
        ("OWNER", "Malik", "Salt okunur erişim"),
    ]
    for code, name, description in roles:
        Role.objects.update_or_create(
            code=code,
            defaults={"name": name, "description": description},
        )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_roles, migrations.RunPython.noop),
    ]
