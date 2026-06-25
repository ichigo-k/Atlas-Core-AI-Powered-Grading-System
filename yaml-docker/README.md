# Hostinger VPS Deployment

This folder contains the Docker Compose configurations to run the full exam system on a single Hostinger VPS.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Hostinger VPS                                                  │
│                                                                 │
│  ┌─────────────────┐    ┌───────────────────────────────────┐  │
│  │  Portal Stack   │    │  Grader Stack                     │  │
│  │                 │    │                                   │  │
│  │  exam-portal    │───▶│  verion-grader (Django)           │  │
│  │  (Next.js)      │    │       │                           │  │
│  │  :3000          │    │       ├──▶ ollama (LLM) :11434    │  │
│  │                 │    │       ├──▶ minio  (S3)  :9000     │  │
│  │  redis          │    │       └──▶ grader-db    :5432     │  │
│  └────────┬────────┘    └───────────────────────────────────┘  │
│           │                                                     │
│           └────── grader-bridge (Docker network) ───────────────┘
│                                                                 │
│  External: Neon PostgreSQL (shared DB)                          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. SSH into your VPS
ssh root@your-vps-ip

# 2. Clone both repos (or copy the files)
git clone <your-portal-repo>
git clone <your-grader-repo>

# 3. Navigate to this folder
cd ai-powered-grading-system/yaml-docker

# 4. Create your .env from the example
cp .env.example .env
nano .env   # fill in real values

# 5. Create the shared Docker network (one-time)
docker network create grader-bridge

# 6. Start the grader stack first (needs Ollama + MinIO ready)
docker compose -f docker-compose.grader.yml up -d

# 7. Wait for services to be healthy
docker compose -f docker-compose.grader.yml ps

# 8. Run Django migrations
docker compose -f docker-compose.grader.yml exec grader python manage.py migrate

# 9. Pull the Ollama model
docker compose -f docker-compose.grader.yml exec ollama ollama pull llama3

# 10. Generate an API key for the portal
docker compose -f docker-compose.grader.yml exec grader python manage.py generate_api_key --label "portal"
# Copy the printed key → paste into .env as GRADER_API_KEY

# 11. Start the portal
docker compose -f docker-compose.portal.yml up -d

# 12. Verify everything is running
docker ps
curl http://localhost:3000/api/health
curl http://localhost:8000/api/health/
```

## Reverse Proxy (HTTPS)

Put Caddy or nginx in front for HTTPS. Example `Caddyfile`:

```
exam.yourdomain.com {
    reverse_proxy localhost:3000
}

grader.yourdomain.com {
    reverse_proxy localhost:8000
}

minio.yourdomain.com {
    reverse_proxy localhost:9001
}
```

## GPU Acceleration (Optional)

If your Hostinger VPS has an NVIDIA GPU:

1. Install the NVIDIA Container Toolkit on the host
2. Uncomment the `deploy` section in `docker-compose.grader.yml` under `ollama`
3. Restart: `docker compose -f docker-compose.grader.yml up -d ollama`

## Useful Commands

```bash
# View logs
docker compose -f docker-compose.grader.yml logs -f grader
docker compose -f docker-compose.portal.yml logs -f portal

# Restart a service
docker compose -f docker-compose.grader.yml restart grader

# Rebuild after code changes
docker compose -f docker-compose.grader.yml up -d --build grader
docker compose -f docker-compose.portal.yml up -d --build portal

# Check MinIO console (bucket management UI)
# Visit http://your-vps-ip:9001  (login with MINIO_ROOT_USER/PASSWORD)

# Shell into a container
docker compose -f docker-compose.grader.yml exec grader bash
docker compose -f docker-compose.portal.yml exec portal sh

# Stop everything
docker compose -f docker-compose.grader.yml down
docker compose -f docker-compose.portal.yml down
```

## Resource Requirements

| Service | RAM | CPU | Disk |
|---------|-----|-----|------|
| Portal (Next.js) | ~256MB | 0.5 core | minimal |
| Grader (Django) | ~128MB | 0.5 core | minimal |
| Ollama (llama3 7B) | ~4.5GB | 2+ cores | ~4GB model |
| MinIO | ~128MB | minimal | varies (uploads) |
| PostgreSQL | ~64MB | minimal | minimal |
| Redis | ~32MB | minimal | minimal |

**Minimum VPS:** 8GB RAM, 4 CPU cores for llama3 7B on CPU.
Smaller models (e.g. `phi3:mini`) work with 4GB RAM.
