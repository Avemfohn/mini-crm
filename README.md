# mini-erp

Financial tracking for kentsel dönüşüm (urban transformation) construction projects.

## Stack

- **Backend**: Django 5 + Django REST Framework + PostgreSQL
- **Frontend**: Next.js 15 + TypeScript + Tailwind + shadcn/ui

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
python manage.py seed_data --demo
python manage.py createsuperuser
python manage.py runserver
```

### Frontend setup

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app expects the backend at [http://localhost:8000](http://localhost:8000).

### Full local workflow

1. Start backend: `cd backend && python manage.py runserver`
2. Seed demo data: `python manage.py seed_data --demo`
3. Start frontend: `cd frontend && npm run dev`
4. Log in with `demo_admin` / `demo1234` (or `DEMO_USER_PASSWORD` from env)

### Demo data

```bash
python manage.py seed_data --demo
```

Creates `demo-kentsel` with users `demo_admin`, `demo_contractor`, and `demo_owner` (password from `DEMO_USER_PASSWORD`, default `demo1234`).

### API docs (local only)

When `DEBUG=true`, Swagger UI is at `http://localhost:8000/api/v1/docs/`.

### Configuration

Copy `backend/.env.example` to `backend/.env`. Key variables:

| Variable | Purpose |
|----------|---------|
| `DJANGO_SECRET_KEY` | Required in production (must not use dev default) |
| `DJANGO_DEBUG` | `true` for local development |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins |
| `JWT_ACCESS_MINUTES` / `JWT_REFRESH_DAYS` | Token lifetimes |
| `API_PAGE_SIZE` | DRF pagination size |
| `DEMO_USER_PASSWORD` | Password for demo seed users |
| `POSTGRES_*` | Database connection |

## Apps

| App | Purpose |
|-----|---------|
| `apps.core` | Shared model mixins and validators |
| `apps.projects` | Project, Block, Unit |
| `apps.parties` | Owner, temporal UnitOwnership |
| `apps.accounts` | UserProfile, Role, ProjectMembership (RBAC) |
| `apps.ledger` | TransactionCategory, append-only Transaction |
