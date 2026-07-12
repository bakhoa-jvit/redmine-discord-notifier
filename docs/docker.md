# Docker Deployment

## Local Docker Compose

Create local config files:

```bash
cp .env.example .env
cp config/projects.example.json config/projects.json
```

Edit both files, then run:

```bash
docker compose up --build
```

Run in the background:

```bash
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f
```

Restart:

```bash
docker compose restart
```

## SQLite Persistence

The compose file mounts local data into the container:

```yaml
volumes:
  - ./data:/app/data
```

Use this path in container deployments:

```env
SQLITE_PATH=/app/data/notifier.sqlite
```
