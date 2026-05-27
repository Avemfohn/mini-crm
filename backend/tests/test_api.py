import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import ProjectMembership, Role, RoleCode, UserProfile
from apps.ledger.models import (
    PaymentPlan,
    Transaction,
    TransactionCategory,
    TransactionDirection,
    TransactionStatus,
)
from apps.parties.models import Owner, UnitOwnership
from apps.projects.models import Block, Project, Unit
from apps.projects.setup import seed_default_categories

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def roles(db):
    roles = {}
    for code, name, description in [
        (RoleCode.ADMIN, "Administrator", "Full system access"),
        (RoleCode.CONTRACTOR, "Contractor", "Manage projects and ledger"),
        (RoleCode.OWNER, "Owner", "Read-only portal access"),
    ]:
        role, _ = Role.objects.update_or_create(
            code=code,
            defaults={"name": name, "description": description},
        )
        roles[code] = role
    return roles


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(username="admin", password="pass1234")


@pytest.fixture
def contractor_user(db):
    return User.objects.create_user(username="contractor", password="pass1234")


@pytest.fixture
def owner_user(db):
    user = User.objects.create_user(username="owner", password="pass1234")
    UserProfile.objects.create(user=user, display_name="Owner User")
    return user


@pytest.fixture
def outsider_user(db):
    return User.objects.create_user(username="outsider", password="pass1234")


@pytest.fixture
def project(db, admin_user):
    return Project.objects.create(
        name="Test Project",
        code="test-project",
        created_by=admin_user,
        updated_by=admin_user,
    )


@pytest.fixture
def seeded_project(db, roles, admin_user, contractor_user, owner_user, project):
    ProjectMembership.objects.create(
        user=admin_user, project=project, role=roles[RoleCode.ADMIN], is_active=True
    )
    ProjectMembership.objects.create(
        user=contractor_user, project=project, role=roles[RoleCode.CONTRACTOR], is_active=True
    )
    ProjectMembership.objects.create(
        user=owner_user, project=project, role=roles[RoleCode.OWNER], is_active=True
    )
    return project


@pytest.fixture
def block(db, seeded_project, admin_user):
    return Block.objects.create(
        project=seeded_project,
        name="Block A",
        code="a",
        created_by=admin_user,
        updated_by=admin_user,
    )


@pytest.fixture
def unit(db, seeded_project, block, admin_user):
    return Unit.objects.create(
        project=seeded_project,
        block=block,
        unit_number="101",
        created_by=admin_user,
        updated_by=admin_user,
    )


@pytest.fixture
def owner_profile(db, owner_user, admin_user):
    return Owner.objects.create(
        full_name="Owner User",
        user=owner_user,
        created_by=admin_user,
        updated_by=admin_user,
    )


@pytest.fixture
def ownership(db, unit, owner_profile, admin_user):
    return UnitOwnership.objects.create(
        unit=unit,
        owner=owner_profile,
        effective_from="2024-01-01",
        created_by=admin_user,
        updated_by=admin_user,
    )


@pytest.fixture
def category(db, seeded_project):
    return TransactionCategory.objects.create(
        project=seeded_project,
        name="Ödeme",
        slug="odeme",
    )


def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


def get_token(api_client, username, password):
    response = api_client.post(
        "/api/v1/auth/token/",
        {"username": username, "password": password},
        format="json",
    )
    assert response.status_code == 200
    return response.data["access"]


@pytest.mark.django_db
class TestAuth:
    def test_token_obtain_and_refresh(self, api_client, admin_user):
        response = api_client.post(
            "/api/v1/auth/token/",
            {"username": "admin", "password": "pass1234"},
            format="json",
        )
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data

        refresh_response = api_client.post(
            "/api/v1/auth/token/refresh/",
            {"refresh": response.data["refresh"]},
            format="json",
        )
        assert refresh_response.status_code == 200
        assert "access" in refresh_response.data

    def test_me_endpoint(self, api_client, seeded_project, admin_user, roles):
        auth_client(api_client, admin_user)
        response = api_client.get("/api/v1/auth/me/")
        assert response.status_code == 200
        assert response.data["user"]["username"] == "admin"
        assert len(response.data["memberships"]) == 1
        assert response.data["memberships"][0]["role"]["code"] == RoleCode.ADMIN

    def test_patch_me_updates_profile(self, api_client, admin_user):
        auth_client(api_client, admin_user)
        response = api_client.patch(
            "/api/v1/auth/me/",
            {"display_name": "Baba", "phone": "5551234567"},
            format="json",
        )
        assert response.status_code == 200
        assert response.data["profile"]["display_name"] == "Baba"
        assert response.data["profile"]["phone"] == "5551234567"

    def test_patch_me_changes_password(self, api_client, admin_user):
        auth_client(api_client, admin_user)
        response = api_client.patch(
            "/api/v1/auth/me/",
            {"current_password": "pass1234", "new_password": "newpass5678"},
            format="json",
        )
        assert response.status_code == 200
        admin_user.refresh_from_db()
        assert admin_user.check_password("newpass5678")


@pytest.mark.django_db
class TestProjects:
    def test_list_scoped_to_memberships(
        self, api_client, seeded_project, contractor_user, outsider_user
    ):
        auth_client(api_client, contractor_user)
        response = api_client.get("/api/v1/projects/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 1

        auth_client(api_client, outsider_user)
        response = api_client.get("/api/v1/projects/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 0

    def test_create_project_adds_contractor_membership(self, api_client, admin_user, roles):
        auth_client(api_client, admin_user)
        response = api_client.post(
            "/api/v1/projects/",
            {"name": "New", "code": "new-project"},
            format="json",
        )
        assert response.status_code == 201
        project_id = response.data["id"]
        assert ProjectMembership.objects.filter(
            user=admin_user,
            project_id=project_id,
            role=roles[RoleCode.CONTRACTOR],
        ).exists()

    def test_create_project_seeds_block_and_categories(self, api_client, admin_user, roles):
        auth_client(api_client, admin_user)
        response = api_client.post(
            "/api/v1/projects/",
            {"name": "Seeded", "code": "seeded-project"},
            format="json",
        )
        assert response.status_code == 201
        project_id = response.data["id"]
        assert Block.objects.filter(project_id=project_id, name="Ana Blok", code="A").exists()
        assert TransactionCategory.objects.filter(project_id=project_id).count() == 6
        assert TransactionCategory.objects.filter(
            project_id=project_id, slug="odeme"
        ).exists()
        assert TransactionCategory.objects.filter(
            project_id=project_id, slug="cimento", direction_hint="OUTFLOW"
        ).exists()

    def test_soft_delete_unit(self, api_client, seeded_project, contractor_user, unit):
        auth_client(api_client, contractor_user)
        url = f"/api/v1/projects/{seeded_project.id}/units/{unit.id}/"
        response = api_client.delete(url)
        assert response.status_code == 204
        unit.refresh_from_db()
        assert unit.is_deleted is True

        list_response = api_client.get(f"/api/v1/projects/{seeded_project.id}/units/")
        assert list_response.status_code == 200
        assert len(list_response.data["results"]) == 0

    def test_outflow_without_category_uses_outflow_default(
        self, api_client, seeded_project, contractor_user
    ):
        seed_default_categories(seeded_project)
        outflow_default = TransactionCategory.objects.get(
            project=seeded_project, slug="genel-gider"
        )
        auth_client(api_client, contractor_user)
        response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "transaction_date": "2024-06-01",
                "amount": "50000.00",
                "direction": TransactionDirection.OUTFLOW,
                "description": "Çimento alımı",
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["category"] == str(outflow_default.id)

    def test_transaction_list_direction_filter(
        self, api_client, seeded_project, contractor_user, unit, category
    ):
        auth_client(api_client, contractor_user)
        seed_default_categories(seeded_project)
        spending = TransactionCategory.objects.get(
            project=seeded_project, slug="cimento"
        )
        api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "unit": str(unit.id),
                "category": str(category.id),
                "transaction_date": "2024-06-01",
                "amount": "1000.00",
                "direction": TransactionDirection.INFLOW,
            },
            format="json",
        )
        api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "category": str(spending.id),
                "transaction_date": "2024-06-02",
                "amount": "2000.00",
                "direction": TransactionDirection.OUTFLOW,
                "description": "Demir",
            },
            format="json",
        )
        inflow_response = api_client.get(
            f"/api/v1/projects/{seeded_project.id}/transactions/?direction=INFLOW"
        )
        outflow_response = api_client.get(
            f"/api/v1/projects/{seeded_project.id}/transactions/?direction=OUTFLOW"
        )
        assert inflow_response.status_code == 200
        assert outflow_response.status_code == 200
        assert all(
            row["direction"] == TransactionDirection.INFLOW
            for row in inflow_response.data["results"]
        )
        assert all(
            row["direction"] == TransactionDirection.OUTFLOW
            for row in outflow_response.data["results"]
        )
        assert len(outflow_response.data["results"]) >= 1


@pytest.mark.django_db
class TestRBAC:
    def test_outsider_denied_project_resources(
        self, api_client, seeded_project, outsider_user, unit
    ):
        auth_client(api_client, outsider_user)
        response = api_client.get(f"/api/v1/projects/{seeded_project.id}/units/")
        assert response.status_code == 403

    def test_owner_cannot_create_transaction(
        self, api_client, seeded_project, owner_user, unit, category, ownership
    ):
        auth_client(api_client, owner_user)
        response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "unit": str(unit.id),
                "category": str(category.id),
                "transaction_date": "2024-06-01",
                "amount": "1000.00",
                "direction": TransactionDirection.INFLOW,
            },
            format="json",
        )
        assert response.status_code == 403

    def test_contractor_can_create_and_post_transaction(
        self, api_client, seeded_project, contractor_user, unit, category
    ):
        auth_client(api_client, contractor_user)
        create_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "unit": str(unit.id),
                "category": str(category.id),
                "transaction_date": "2024-06-01",
                "amount": "1000.00",
                "direction": TransactionDirection.INFLOW,
            },
            format="json",
        )
        assert create_response.status_code == 201
        txn_id = create_response.data["id"]
        assert create_response.data["status"] == TransactionStatus.DRAFT

        post_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/{txn_id}/post/"
        )
        assert post_response.status_code == 200
        assert post_response.data["status"] == TransactionStatus.ACTIVE

    def test_owner_sees_only_own_units(
        self, api_client, seeded_project, owner_user, unit, ownership, admin_user, block
    ):
        other_unit = Unit.objects.create(
            project=seeded_project,
            block=block,
            unit_number="102",
            created_by=admin_user,
            updated_by=admin_user,
        )
        auth_client(api_client, owner_user)
        response = api_client.get(f"/api/v1/projects/{seeded_project.id}/units/")
        assert response.status_code == 200
        unit_ids = {item["id"] for item in response.data["results"]}
        assert str(unit.id) in unit_ids
        assert str(other_unit.id) not in unit_ids

    def test_membership_admin_only(
        self, api_client, seeded_project, contractor_user, admin_user, roles
    ):
        auth_client(api_client, contractor_user)
        response = api_client.get(f"/api/v1/projects/{seeded_project.id}/memberships/")
        assert response.status_code == 403

        auth_client(api_client, admin_user)
        response = api_client.get(f"/api/v1/projects/{seeded_project.id}/memberships/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 3

    def test_duplicate_membership_rejected(
        self, api_client, seeded_project, admin_user, contractor_user, roles
    ):
        auth_client(api_client, admin_user)
        response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/memberships/",
            {"user_id": contractor_user.id, "role_id": roles[RoleCode.CONTRACTOR].id},
            format="json",
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestLedger:
    def test_void_reversal_entry_without_chaining(
        self, api_client, seeded_project, contractor_user, unit, category
    ):
        auth_client(api_client, contractor_user)
        original = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "unit": str(unit.id),
                "category": str(category.id),
                "transaction_date": "2024-07-01",
                "amount": "100.00",
                "direction": TransactionDirection.INFLOW,
            },
            format="json",
        )
        original_id = original.data["id"]
        api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/{original_id}/post/"
        )
        api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/{original_id}/void/",
            {"void_reason": "test"},
            format="json",
        )
        reversal = Transaction.objects.get(
            entry_type="REVERSAL",
            reverses_id=original_id,
            status=TransactionStatus.ACTIVE,
        )
        void_reversal = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/{reversal.id}/void/",
            {"void_reason": "cleanup"},
            format="json",
        )
        assert void_reversal.status_code == 200
        assert void_reversal.data["status"] == TransactionStatus.VOIDED
        assert not Transaction.objects.filter(
            reverses_id=reversal.id,
            status=TransactionStatus.ACTIVE,
        ).exists()

    def test_void_creates_reversal(
        self, api_client, seeded_project, contractor_user, unit, category
    ):
        auth_client(api_client, contractor_user)
        create_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "unit": str(unit.id),
                "category": str(category.id),
                "transaction_date": "2024-06-01",
                "amount": "500.00",
                "direction": TransactionDirection.INFLOW,
            },
            format="json",
        )
        txn_id = create_response.data["id"]
        api_client.post(f"/api/v1/projects/{seeded_project.id}/transactions/{txn_id}/post/")

        void_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/{txn_id}/void/",
            {"void_reason": "mistake", "create_reversal": True},
            format="json",
        )
        assert void_response.status_code == 200
        assert void_response.data["status"] == TransactionStatus.VOIDED
        assert Transaction.objects.filter(entry_type="REVERSAL").exists()

    def test_void_inflow_without_reversal_by_default(
        self, api_client, seeded_project, contractor_user, unit, category
    ):
        auth_client(api_client, contractor_user)
        create_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "unit": str(unit.id),
                "category": str(category.id),
                "transaction_date": "2024-06-01",
                "amount": "50000.00",
                "direction": TransactionDirection.INFLOW,
            },
            format="json",
        )
        txn_id = create_response.data["id"]
        api_client.post(f"/api/v1/projects/{seeded_project.id}/transactions/{txn_id}/post/")

        void_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/{txn_id}/void/",
            {"void_reason": "cancelled"},
            format="json",
        )
        assert void_response.status_code == 200
        assert not Transaction.objects.filter(entry_type="REVERSAL", reverses_id=txn_id).exists()

    def test_active_transaction_immutable(
        self, api_client, seeded_project, contractor_user, unit, category
    ):
        auth_client(api_client, contractor_user)
        create_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "unit": str(unit.id),
                "category": str(category.id),
                "transaction_date": "2024-06-01",
                "amount": "500.00",
                "direction": TransactionDirection.INFLOW,
            },
            format="json",
        )
        txn_id = create_response.data["id"]
        api_client.post(f"/api/v1/projects/{seeded_project.id}/transactions/{txn_id}/post/")

        update_response = api_client.patch(
            f"/api/v1/projects/{seeded_project.id}/transactions/{txn_id}/",
            {"amount": "999.00"},
            format="json",
        )
        assert update_response.status_code == 400

    def test_delete_transaction_not_allowed(
        self, api_client, seeded_project, contractor_user, unit, category
    ):
        auth_client(api_client, contractor_user)
        create_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "unit": str(unit.id),
                "category": str(category.id),
                "transaction_date": "2024-06-01",
                "amount": "500.00",
                "direction": TransactionDirection.INFLOW,
            },
            format="json",
        )
        txn_id = create_response.data["id"]
        delete_response = api_client.delete(
            f"/api/v1/projects/{seeded_project.id}/transactions/{txn_id}/"
        )
        assert delete_response.status_code == 405


@pytest.mark.django_db
class TestSoftDeleteRestore:
    def test_admin_can_list_and_restore_deleted_unit(
        self, api_client, seeded_project, admin_user, unit
    ):
        auth_client(api_client, admin_user)
        delete_url = f"/api/v1/projects/{seeded_project.id}/units/{unit.id}/"
        api_client.delete(delete_url)

        list_response = api_client.get(f"/api/v1/projects/{seeded_project.id}/units/")
        assert list_response.status_code == 200
        assert len(list_response.data["results"]) == 0

        deleted_list = api_client.get(
            f"/api/v1/projects/{seeded_project.id}/units/?include_deleted=true"
        )
        assert deleted_list.status_code == 200
        assert len(deleted_list.data["results"]) == 1
        assert deleted_list.data["results"][0]["is_deleted"] is True

        restore_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/units/{unit.id}/restore/"
        )
        assert restore_response.status_code == 200
        assert restore_response.data["is_deleted"] is False

        list_response = api_client.get(f"/api/v1/projects/{seeded_project.id}/units/")
        assert len(list_response.data["results"]) == 1

    def test_contractor_cannot_view_or_restore_deleted(
        self, api_client, seeded_project, contractor_user, admin_user, unit
    ):
        auth_client(api_client, admin_user)
        api_client.delete(f"/api/v1/projects/{seeded_project.id}/units/{unit.id}/")

        auth_client(api_client, contractor_user)
        deleted_list = api_client.get(
            f"/api/v1/projects/{seeded_project.id}/units/?include_deleted=true"
        )
        assert deleted_list.status_code == 403

        restore_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/units/{unit.id}/restore/"
        )
        assert restore_response.status_code == 403


@pytest.mark.django_db
class TestDemoSeed:
    def test_demo_seed_creates_expected_data(self):
        from django.core.management import call_command

        call_command("seed_data", "--demo")
        project = Project.objects.get(code="demo-kentsel")
        assert User.objects.filter(username="demo_admin").exists()
        assert User.objects.filter(username="demo_contractor").exists()
        assert User.objects.filter(username="demo_owner").exists()
        assert ProjectMembership.objects.filter(project=project).count() == 3
        assert Block.objects.filter(project=project, is_deleted=False).count() == 2
        assert Unit.objects.filter(project=project, is_deleted=False).count() == 6
        assert Owner.objects.filter(is_deleted=False).count() >= 3
        assert TransactionCategory.objects.filter(project=project, is_deleted=False).count() == 6
        assert Transaction.objects.filter(project=project).count() >= 3

    def test_demo_seed_is_idempotent(self):
        from django.core.management import call_command

        call_command("seed_data", "--demo")
        counts = {
            "projects": Project.objects.filter(code="demo-kentsel").count(),
            "units": Unit.objects.filter(project__code="demo-kentsel").count(),
            "transactions": Transaction.objects.filter(project__code="demo-kentsel").count(),
        }
        call_command("seed_data", "--demo")
        assert Project.objects.filter(code="demo-kentsel").count() == counts["projects"]
        assert Unit.objects.filter(project__code="demo-kentsel").count() == counts["units"]
        assert Transaction.objects.filter(project__code="demo-kentsel").count() == counts["transactions"]


@pytest.mark.django_db
class TestPaymentPlansAndSetOwner:
    def test_set_owner_on_unit(
        self, api_client, seeded_project, contractor_user, unit, owner_profile, admin_user
    ):
        auth_client(api_client, contractor_user)
        response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/units/{unit.id}/set-owner/",
            {"owner_id": str(owner_profile.id)},
            format="json",
        )
        assert response.status_code == 201
        assert response.data["owner"]["id"] == str(owner_profile.id)

    def test_transaction_without_category_uses_default(
        self, api_client, seeded_project, contractor_user, unit, category
    ):
        auth_client(api_client, contractor_user)
        response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "unit": str(unit.id),
                "transaction_date": "2024-06-01",
                "amount": "500.00",
                "direction": TransactionDirection.INFLOW,
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["category"] == str(category.id)

    def test_transaction_list_does_not_500_with_many_instances(
        self, api_client, seeded_project, contractor_user, unit, category, owner_profile, ownership
    ):
        auth_client(api_client, contractor_user)
        for amount in ("100.00", "200.00"):
            create_response = api_client.post(
                f"/api/v1/projects/{seeded_project.id}/transactions/",
                {
                    "unit": str(unit.id),
                    "owner": str(owner_profile.id),
                    "transaction_date": "2024-06-01",
                    "amount": amount,
                    "direction": TransactionDirection.INFLOW,
                },
                format="json",
            )
            txn_id = create_response.data["id"]
            api_client.post(
                f"/api/v1/projects/{seeded_project.id}/transactions/{txn_id}/post/"
            )

        list_response = api_client.get(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {"unit": str(unit.id)},
        )
        assert list_response.status_code == 200
        assert list_response.data["count"] >= 2
        assert list_response.data["results"][0]["transaction_date"] == "2024-06-01"

    def test_posted_transaction_lists_by_unit_with_date(
        self, api_client, seeded_project, contractor_user, unit, owner_profile, ownership
    ):
        auth_client(api_client, contractor_user)
        create_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {
                "unit": str(unit.id),
                "owner": str(owner_profile.id),
                "transaction_date": "2024-06-15",
                "amount": "3333.00",
                "direction": TransactionDirection.INFLOW,
            },
            format="json",
        )
        assert create_response.status_code == 201
        assert create_response.data["transaction_date"] == "2024-06-15"
        txn_id = create_response.data["id"]

        post_response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/transactions/{txn_id}/post/"
        )
        assert post_response.status_code == 200
        assert post_response.data["transaction_date"] == "2024-06-15"
        assert post_response.data["status"] == TransactionStatus.ACTIVE

        list_response = api_client.get(
            f"/api/v1/projects/{seeded_project.id}/transactions/",
            {"unit": str(unit.id)},
        )
        assert list_response.status_code == 200
        assert list_response.data["count"] == 1
        assert list_response.data["results"][0]["transaction_date"] == "2024-06-15"
        assert list_response.data["results"][0]["amount"] == "3333.00"

    def test_payment_plan_schedule(
        self, api_client, seeded_project, contractor_user, unit, owner_profile, ownership
    ):
        auth_client(api_client, contractor_user)
        response = api_client.post(
            f"/api/v1/projects/{seeded_project.id}/payment-plans/",
            {
                "unit_id": str(unit.id),
                "owner_id": str(owner_profile.id),
                "total_amount": "1000000.00",
                "installment_count": 3,
                "start_date": "2024-01-01",
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.data["monthly_amount"] == "333333.33"
        assert len(response.data["schedule"]) == 3
        assert response.data["schedule"][0]["expected"] == "333333.33"


@pytest.mark.django_db
class TestOpenAPI:
    def test_schema_available_in_debug(self, api_client):
        response = api_client.get("/api/v1/schema/")
        assert response.status_code == 200

    def test_docs_available_in_debug(self, api_client):
        response = api_client.get("/api/v1/docs/")
        assert response.status_code == 200

    def test_schema_not_available_when_debug_false(self, api_client, settings):
        settings.DEBUG = False
        response = api_client.get("/api/v1/schema/")
        assert response.status_code == 404

