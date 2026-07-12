# Architecture

The service is split into small modules:

```text
src/
  index.ts                  app entrypoint and graceful shutdown
  config.ts                 env/project config loading and validation
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
    formatter.ts            Discord embed formatting
  redmine/
    client.ts               Redmine REST API client
    types.ts                Redmine response types
  state/
    database.ts             SQLite open/migrations
    repositories.ts         project, issue, outbox repositories
```

## Main Flow

1. Load `.env` and project configuration.
2. Open SQLite and run migrations.
3. Initialize a baseline for new projects.
4. Poll each configured Redmine project.
5. Fetch issue journals only for changed issues.
6. Detect events from new journals.
7. Insert events into the SQLite outbox with deterministic event keys.
8. Send due outbox events to Discord.
9. Mark sent events or schedule retry on failure.

## Configuration Layers

Runtime settings stay in `.env` or hosted platform variables:

- Redmine base URL
- Redmine API key
- SQLite path
- polling interval
- log level

Project routing is configured separately:

- local: `config/projects.json`
- hosted/Railway: `PROJECTS_CONFIG_JSON`

This split keeps runtime settings separate from project-to-webhook routing.

## Failure Model

The service aims for practical at-least-once delivery:

- Poll overlap prevents missing Redmine changes around poll boundaries.
- SQLite outbox prevents duplicate sends during normal retries/restarts.
- Discord webhook delivery is marked `sent` only after Discord returns success.

One rare duplicate remains possible: Discord accepts a message, then the process crashes before SQLite marks the event as sent. Discord webhooks do not provide strong idempotency.
