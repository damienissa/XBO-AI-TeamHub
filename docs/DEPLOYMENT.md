# Deployment & Setup Guide

## Prerequisites

- Docker and Docker Compose v2
- Git

## Local Development Setup

### 1. Clone and Configure

```bash
git clone <repo-url>
cd XBO-AI-TeamHub

# Copy environment file
cp AI-teamHub-app/.env.example AI-teamHub-app/.env
```

### 2. Configure Environment Variables

Edit `AI-teamHub-app/.env`:

```bash
# Database
POSTGRES_USER=xbo
POSTGRES_PASSWORD=change_me_to_secure_password
POSTGRES_DB=xbo_teamhub

# Security
SECRET_KEY=change_me_to_64_random_chars
SEED_ADMIN_PASSWORD=change_me

# Cookies (dev settings)
COOKIE_SAMESITE=lax
COOKIE_SECURE=false

# Database connection (set automatically by docker-compose)
# DATABASE_URL=postgresql+asyncpg://xbo:password@postgres:5432/xbo_teamhub

# AI Features (optional)
AI_ENABLED=false
ANTHROPIC_API_KEY=
AI_MODEL=claude-haiku-4-5
AI_TEAM_HOURLY_RATE=75

# Email (optional, leave empty to skip)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@xbo.com
```

### 3. Start Services

```bash
docker compose up
```

This starts:
- **PostgreSQL 16** on port 5432
- **FastAPI Backend** on port 8000 (with hot reload)
- **Next.js Frontend** on port 3000 (with hot reload)

### 4. Initialize Database

On first startup, Alembic migrations run automatically. The seed script creates:
- 23 departments
- Admin user (email from seed, password from `SEED_ADMIN_PASSWORD`)

### 5. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **Swagger Docs:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health

## Docker Compose Services

### PostgreSQL

```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_USER: ${POSTGRES_USER}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    POSTGRES_DB: ${POSTGRES_DB}
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready"]
    interval: 10s
    retries: 5
```

### Backend

```yaml
backend:
  build: ./AI-teamHub-app/backend
  command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  env_file: ./AI-teamHub-app/.env
  environment:
    DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
  ports:
    - "8000:8000"
  volumes:
    - ./AI-teamHub-app/backend:/app
  depends_on:
    postgres:
      condition: service_healthy
```

### Frontend

```yaml
frontend:
  build: ./AI-teamHub-app/frontend
  command: npm run dev
  ports:
    - "3000:3000"
  volumes:
    - ./AI-teamHub-app/frontend:/app
    - /app/node_modules
  environment:
    NEXT_PUBLIC_API_URL: http://localhost:8000
    INTERNAL_API_URL: http://backend:8000
    NEXT_PUBLIC_SESSION_SECRET: ${SECRET_KEY}
  depends_on:
    - backend
```

### Volumes

- `postgres_data` — PostgreSQL data persistence
- `uploads_data` — File uploads storage

## Environment Variables Reference

### Required

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |
| `SECRET_KEY` | JWT signing key (64+ random chars) |
| `SEED_ADMIN_PASSWORD` | Initial admin user password |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `COOKIE_SAMESITE` | `strict` | Cookie SameSite (`lax` for dev) |
| `COOKIE_SECURE` | `false` | HTTPS-only cookies (`true` for prod) |
| `DB_ECHO` | `false` | SQL query logging |
| `AI_ENABLED` | `false` | Enable AI features |
| `ANTHROPIC_API_KEY` | `""` | Claude API key |
| `AI_MODEL` | `claude-haiku-4-5` | AI model identifier |
| `AI_TEAM_HOURLY_RATE` | `75` | Dev cost per hour (ROI calculation) |
| `UPLOAD_DIR` | `/app/uploads` | File storage path |
| `MAX_UPLOAD_BYTES` | `10485760` | Max upload size (10 MB) |
| `SMTP_HOST` | `""` | SMTP server (empty = no emails) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | `""` | SMTP username |
| `SMTP_PASSWORD` | `""` | SMTP password |
| `SMTP_FROM` | `noreply@xbo.com` | Sender email |

### Frontend-Specific

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL for browser requests (e.g., `http://localhost:8000`) |
| `INTERNAL_API_URL` | Backend URL for server-side requests (e.g., `http://backend:8000`) |
| `NEXT_PUBLIC_SESSION_SECRET` | JWT secret for middleware verification |

## Production Deployment

### Recommended Architecture

```
                    ┌─────────────┐
                    │   CDN/LB    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │  Next.js   │ │  API  │ │  Static   │
        │  Server    │ │ (Fast │ │  Assets   │
        │            │ │  API) │ │           │
        └────────────┘ └───┬───┘ └───────────┘
                           │
                    ┌──────▼──────┐
                    │  Managed    │
                    │  PostgreSQL │
                    │  (RDS)      │
                    └─────────────┘
```

### Production Checklist

1. **Database:**
   - Use managed PostgreSQL (AWS RDS, GCP Cloud SQL, Azure Database)
   - Enable connection pooling (PgBouncer) for serverless backends
   - Regular automated backups

2. **Security:**
   - `COOKIE_SECURE=true` (requires HTTPS)
   - `COOKIE_SAMESITE=strict`
   - Strong `SECRET_KEY` (64+ random characters)
   - Do not expose PostgreSQL port publicly

3. **Networking:**
   - `NEXT_PUBLIC_API_URL` = public domain (API Gateway / load balancer)
   - `INTERNAL_API_URL` = internal service DNS (Kubernetes service, etc.)
   - HTTPS termination at load balancer

4. **AI Features:**
   - `AI_ENABLED=true` with valid `ANTHROPIC_API_KEY`
   - Monitor API usage and costs
   - Consider rate limiting

5. **Email:**
   - Configure SMTP for notification emails
   - Use a transactional email service (SES, SendGrid, etc.)

6. **Monitoring:**
   - Health check endpoint: GET /health
   - Database connection monitoring
   - Application logging (uvicorn access logs)

### Docker Images

**Backend:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Frontend:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

For production, modify frontend Dockerfile to build and serve:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

## Database Management

### Run Migrations
```bash
# Inside backend container
docker compose exec backend alembic upgrade head
```

### Create New Migration
```bash
docker compose exec backend alembic revision --autogenerate -m "description"
```

### Rollback Migration
```bash
docker compose exec backend alembic downgrade -1
```

### Seed Database
```bash
docker compose exec backend python -m app.scripts.seed
```

## Troubleshooting

### Backend won't start
- Check `DATABASE_URL` format: `postgresql+asyncpg://user:pass@host:5432/db`
- Ensure PostgreSQL is healthy: `docker compose ps`
- Check logs: `docker compose logs backend`

### Frontend can't reach backend
- Verify `NEXT_PUBLIC_API_URL` matches backend port
- In Docker: `INTERNAL_API_URL` must use service name (`http://backend:8000`)
- Check CORS: Backend allows `localhost:3000` by default

### Authentication issues
- Verify `SECRET_KEY` matches between backend and frontend (`NEXT_PUBLIC_SESSION_SECRET`)
- For dev: Set `COOKIE_SAMESITE=lax` (not `strict`)
- Clear browser cookies if tokens are stale

### AI features not working
- Verify `AI_ENABLED=true` in .env
- Verify `ANTHROPIC_API_KEY` is valid
- Check backend logs for API errors
- Frontend shows AI buttons only when `/api/config` returns `ai_enabled: true`
