# Docker Deployment

## Local Docker Compose

Create a local env file:

```bash
cp .env.example .env
```

Edit it — at minimum set `REDMINE_BASE_URL`, `REDMINE_API_KEY`,
`ADMIN_SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` — then run:

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

Open `http://localhost:3000/login` and sign in with `ADMIN_USERNAME` /
`ADMIN_PASSWORD` to manage projects and the assignee mapping.

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

Project routing and the assignee mapping live inside this SQLite file —
back it up along with `./data` if you need to migrate the deployment.
