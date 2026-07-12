# State Model

SQLite is used as operational state, not as a full Redmine mirror.

By default, the database file is:

```text
data/notifier.sqlite
```

In containers or Railway, use:

```env
SQLITE_PATH=/app/data/notifier.sqlite
```

## Tables

### `projects_state`

Stores one row per monitored Redmine project.

Important fields:

- `project_id`: Redmine project identifier.
- `initialized`: whether baseline was created.
- `baseline_at`: first startup timestamp for that project.
- `last_completed_watermark`: latest successfully processed issue update timestamp.
- `last_error`: latest poll error for the project.

### `issues_state`

Stores issue-level progress.

Important fields:

- `project_id`
- `issue_id`
- `last_seen_updated_on`
- `last_seen_journal_id`

This prevents old journals from being reprocessed after restart.

### `notification_outbox`

Stores detected notification events.

Important fields:

- `event_key`: deterministic unique key for deduplication.
- `project_id`
- `issue_id`
- `journal_id`
- `event_type`
- `payload_json`: Discord payload to send.
- `status`: `pending`, `failed`, or `sent`.
- `attempt_count`
- `next_attempt_at`
- `last_error`
- `sent_at`

## Inspecting SQLite

With `sqlite3`:

```sql
.tables
SELECT * FROM projects_state;
SELECT * FROM issues_state;
SELECT event_key, project_id, issue_id, event_type, status, attempt_count, detected_at, sent_at
FROM notification_outbox
ORDER BY detected_at DESC;
```

GUI options:

- DB Browser for SQLite
- SQLiteStudio
- DBeaver
