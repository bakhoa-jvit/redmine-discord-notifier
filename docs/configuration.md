# Configuration

The service uses two configuration layers:

- `.env` for runtime settings (Redmine connection, poller tuning, admin
  credentials).
- SQLite (`projects` and `assignee_discord_ids` tables) for project routing
  and the shared assignee mapping, managed through the admin web UI.

## Runtime Variables

```env
REDMINE_BASE_URL=https://redmine.example.com
REDMINE_API_KEY=replace_with_your_personal_api_key

POLL_INTERVAL_SECONDS=60
POLL_OVERLAP_SECONDS=120
REDMINE_PAGE_LIMIT=100
MAX_ISSUE_DETAIL_REQUESTS_PER_CYCLE=200
SKIP_MISSED_ON_START=true
SQLITE_PATH=./data/notifier.sqlite
STARTUP_MODE=baseline
LOG_LEVEL=info

ADMIN_PORT=3000
ADMIN_SESSION_SECRET=replace_with_a_long_random_string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace_with_a_strong_password
```

`ADMIN_USERNAME`/`ADMIN_PASSWORD` only seed the single admin account the
first time the service boots with an empty `admin_users` table. After that,
change the password from the admin UI's Account page — the env vars are
no longer read.

## Admin Web UI

Open `http://<host>:<ADMIN_PORT>/login` and sign in with the seeded admin
account. From there:

- **Projects** — add/edit/delete a project's id, Discord webhook URL, and
  enabled event types.
- **Assignees** — manage the shared Redmine-user-id → Discord-id mapping
  used to `@mention` the assignee in notifications, across all projects.
- **Account** — change the admin password.

Changes made through the UI apply on the poller's next cycle (no restart
needed).

Supported event types:

- `issue_created`
- `comment_added`
- `status_changed`
- `assignee_changed`
- `priority_changed`

## Restart Catch-Up Behavior

By default, the service does not send notifications for activity that
happened while it was stopped:

```env
SKIP_MISSED_ON_START=true
```

This prevents Discord spam after downtime. To catch up missed Redmine
activity after restart, set:

```env
SKIP_MISSED_ON_START=false
```
