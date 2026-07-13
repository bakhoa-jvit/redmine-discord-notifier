# Architecture

The service is split into small modules:

```text
src/
  index.ts                  app entrypoint, admin server startup, graceful shutdown
  config.ts                 env config loading and validation
  poller.ts                 Redmine polling and event enqueueing
  outboxSender.ts           Discord delivery and retry scheduling
  events.ts                 detected event shape
  logger.ts                 structured JSON logging
  sleep.ts                  abortable sleep helper
  time.ts                   timestamp helpers
  detection/
    eventDetector.ts        journal-to-event detection
  discord/
    client.ts               Discord webhook HTTP client
    formatter.ts             Discord embed formatting
  redmine/
    client.ts                Redmine REST API client
    types.ts                 Redmine response types
  state/
    database.ts              SQLite open/migrations
    repositories.ts           project poll-state, issue-state, outbox repositories
    configRepository.ts       project routing + shared assignee mapping (admin-editable)
    adminUserRepository.ts    single admin account (env-seeded, password hash)
  admin/
    server.ts                 Express app factory (session, routers)
    authMiddleware.ts         requireAuth + CSRF token helpers
    authRoutes.ts             login/logout
    projectRoutes.ts          project CRUD pages
    assigneeRoutes.ts         shared assignee mapping CRUD pages
    accountRoutes.ts          change-password page
    views.ts                  shared HTML template helpers
    passwords.ts              scrypt password hashing
```

## Main Flow

1. Load `.env` runtime settings.
2. Open SQLite and run migrations.
3. Seed the admin account if `admin_users` is empty.
4. Start the admin HTTP server (session-authenticated project/assignee
   management).
5. Initialize a baseline for new projects.
6. Poll each project currently in the `projects` table — re-read on every
   cycle, so admin edits (including brand-new projects) apply without a
   restart.
7. Fetch issue journals only for changed issues.
8. Detect events from new journals, resolving assignee mentions from the
   shared `assignee_discord_ids` table.
9. Insert events into the SQLite outbox with deterministic event keys.
10. Send due outbox events to Discord.
11. Mark sent events or schedule retry on failure.

## Configuration Layers

Runtime settings stay in `.env` or hosted platform variables:

- Redmine base URL / API key
- SQLite path
- polling interval
- log level
- admin port / session secret / seeded admin credentials

Project routing and the shared assignee mapping live in SQLite, managed
through the admin web UI — see `docs/configuration.md`.

## Failure Model

The service aims for practical at-least-once delivery:

- Poll overlap prevents missing Redmine changes around poll boundaries.
- SQLite outbox prevents duplicate sends during normal retries/restarts.
- Discord webhook delivery is marked `sent` only after Discord returns
  success.
- A project removed via the admin UI stops being polled immediately; any
  outbox items already queued for it are skipped with a warning log
  instead of failing.

One rare duplicate remains possible: Discord accepts a message, then the
process crashes before SQLite marks the event as sent. Discord webhooks do
not provide strong idempotency.
