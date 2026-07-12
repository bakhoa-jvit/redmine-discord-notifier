# Redmine Discord Notifier

Node.js + TypeScript service that polls the Redmine REST API and sends issue activity notifications to Discord webhooks.

One shared service can monitor multiple Redmine projects and route each project to a different Discord webhook.

## What It Detects

- New issues
- New comments
- Status changes
- Assignee changes
- Priority changes

## Startup Behavior

The default `STARTUP_MODE=baseline` prevents historical spam. On first startup for a project, the service records a baseline timestamp and starts notifying only for issue/journal activity after that timestamp.

By default, `SKIP_MISSED_ON_START=true` also prevents a burst of catch-up notifications after the service has been stopped for a while.

## Local Setup

```bash
pnpm install
cp .env.example .env
cp config/projects.example.json config/projects.json
pnpm run build
pnpm start
```

Edit `.env` with your Redmine/runtime settings, then edit `config/projects.json` with project routing and Discord webhooks. Do not commit either file.

## Useful Commands

```bash
pnpm test
pnpm run typecheck
pnpm run lint
```

## Notes

Discord webhooks do not provide true idempotency. The service stores deterministic event keys in SQLite and sends from an outbox, which prevents duplicates across polling overlaps and restarts. A duplicate is still theoretically possible if Discord accepts a message and the process crashes before SQLite is updated.

## Documentation

- [Project overview](docs/project-overview.md)
- [Architecture](docs/architecture.md)
- [Polling and deduplication](docs/polling-and-deduplication.md)
- [State model](docs/state-model.md)
- [Configuration](docs/configuration.md)
- [Docker deployment](docs/docker.md)
- [Railway deployment](docs/railway.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
