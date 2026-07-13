# Roadmap

## Current MVP

- Redmine REST API polling.
- One shared service for multiple projects.
- Project-to-Discord webhook routing, stored in SQLite and managed via an
  authenticated admin web UI.
- Shared Redmine-user-to-Discord-id assignee mapping, stored in SQLite and
  managed via the admin UI.
- Journal-based event detection.
- SQLite state and notification outbox.
- Deduplication by deterministic event keys.
- Discord webhook formatting and delivery.
- Basic retry handling.
- Docker support.
- Railway-friendly environment configuration.
- Config changes apply on the next poll cycle without a restart.

## Good Next Enhancements

- Health/status HTTP endpoint.
- Web dashboard for project status and outbox entries.
- Manual "test webhook" command or endpoint.
- More event types, such as custom fields or attachments.
- Config validation command, for example `pnpm run config:check`.
- More integration tests with mocked Redmine and Discord servers.

## Larger Production Enhancements

- PostgreSQL adapter for multi-instance deployments.
- Leader election or distributed lock if multiple workers run.
- Metrics export, for example Prometheus.
- Multiple admin accounts with per-user audit logging.
- Per-project Redmine API keys.
- Dead-letter queue for permanently failing notifications.
