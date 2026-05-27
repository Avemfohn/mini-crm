import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import apps.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("parties", "0001_initial"),
        ("projects", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("ledger", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PaymentPlan",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "total_amount",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=14,
                        validators=[apps.core.validators.validate_positive_amount],
                    ),
                ),
                ("installment_count", models.PositiveIntegerField(default=1)),
                ("start_date", models.DateField()),
                ("notes", models.TextField(blank=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payment_plans",
                        to="parties.owner",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payment_plans",
                        to="projects.project",
                    ),
                ),
                (
                    "unit",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="payment_plans",
                        to="projects.unit",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="paymentplan",
            constraint=models.UniqueConstraint(
                fields=("project", "unit", "owner"),
                name="uniq_payment_plan_per_unit_owner",
            ),
        ),
        migrations.AddConstraint(
            model_name="paymentplan",
            constraint=models.CheckConstraint(
                check=models.Q(("installment_count__gte", 1)),
                name="payment_plan_installment_count_positive",
            ),
        ),
    ]
