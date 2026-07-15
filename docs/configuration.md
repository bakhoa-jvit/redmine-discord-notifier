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

DATA_CLEANUP_AFTER_SECONDS=2592000
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
- **Assignees** — manage the shared Redmine-user-id → Discord-id mapping,
  across all projects.
- **Account** — change the admin password.

Changes made through the UI apply on the poller's next cycle (no restart
needed).

### Assignee mapping is required to notify, not just to `@mention`

A ticket only gets a Discord notification if its **current assignee** has an
entry in the Assignees mapping. This applies to every event type
(`issue_created`, `comment_added`, `status_changed`, `assignee_changed`,
`priority_changed`) — if the assignee has no mapping, or the issue has no
assignee at all, nothing is sent for that ticket, not even a message without
a mention.

To get notifications for a ticket, make sure whoever it's assigned to has a
row in the Assignees page first.

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

## Notification History Cleanup

`notification_outbox` keeps a row per notification sent, forever, unless
cleaned up. Once per poll cycle, the service checks whether
`DATA_CLEANUP_AFTER_SECONDS` has elapsed since the last cleanup run; if so,
it deletes `sent` rows older than that window (default 30 days):

```env
DATA_CLEANUP_AFTER_SECONDS=2592000
```

This only removes rows already marked `sent` — anything still `pending` or
`failed` (awaiting retry) is never touched. `issues_state` (which issues
have been seen) is not cleaned up by this mechanism.
