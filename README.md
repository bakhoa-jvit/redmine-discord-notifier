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

## Local Setup

```bash
pnpm install
cp .env.example .env
cp config/projects.example.json config/projects.json
pnpm run build
pnpm start
```

Edit `.env` with your Redmine/runtime settings, then edit `config/projects.json` with project routing and Discord webhooks. Do not commit either file.

## Docker Setup

```bash
cp .env.example .env
cp config/projects.example.json config/projects.json
docker compose up --build
```

SQLite data is stored in `./data/notifier.sqlite` by default and mounted into the container.

## Testing Against Real Redmine

Use `.env` for shared runtime settings:

```env
REDMINE_BASE_URL=https://your-redmine.example.com
REDMINE_API_KEY=your_personal_key
PROJECTS_CONFIG_FILE=./config/projects.json
SQLITE_PATH=./data/notifier.sqlite
```

Use `config/projects.json` for project routing:

```json
[
  {
    "id": "data-index",
    "discordWebhookUrl": "https://discord.com/api/webhooks/...",
    "events": ["comment_added", "status_changed"]
  },
  {
    "id": "doctor-health",
    "discordWebhookUrl": "https://discord.com/api/webhooks/...",
    "events": ["issue_created", "comment_added", "status_changed", "assignee_changed"]
  }
]
```

For first production-like run, keep `STARTUP_MODE=baseline`. Create or update a test issue after the service starts, then check Discord. To re-run a clean local test, stop the service and remove only your local SQLite file from `data/`.

## Project Configuration

Use `config/projects.json` for project routing. Each project has:

- `id`: Redmine project identifier or numeric id accepted by your Redmine API
- `discordWebhookUrl`: Discord webhook URL for that project/channel
- `events`: notification types enabled for that project

Supported event types:

- `issue_created`
- `comment_added`
- `status_changed`
- `assignee_changed`
- `priority_changed`

SQLite path and other runtime settings stay in `.env`. To use a different project config path, set `PROJECTS_CONFIG_FILE`. The default is `./config/projects.json`.

## Useful Commands

```bash
pnpm test
pnpm run typecheck
pnpm run lint
```

## Notes

Discord webhooks do not provide true idempotency. The service stores deterministic event keys in SQLite and sends from an outbox, which prevents duplicates across polling overlaps and restarts. A duplicate is still theoretically possible if Discord accepts a message and the process crashes before SQLite is updated.
