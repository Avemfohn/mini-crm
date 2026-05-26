# mini-erp

Financial tracking for kentsel dönüşüm (urban transformation) construction projects.

## Stack

- **Backend**: Django 5 + Django REST Framework + PostgreSQL
- **Frontend**: Next.js (planned)

## Development

### Dev container

Open the repo in a Cursor/VS Code dev container. PostgreSQL starts via `.devcontainer/docker-compose.yml`.

### Local setup

```bash
cd backend
pip install -e ".[dev]"
cp .env.example .env
python manage.py migrate
python manage.py seed_data
python manage.py createsuperuser
python manage.py runserver
```

## Apps

| App | Purpose |
|-----|---------|
| `apps.core` | Shared model mixins and validators |
| `apps.projects` | Project, Block, Unit |
| `apps.parties` | Owner, temporal UnitOwnership |
| `apps.accounts` | UserProfile, Role, ProjectMembership (RBAC) |
| `apps.ledger` | TransactionCategory, append-only Transaction |
