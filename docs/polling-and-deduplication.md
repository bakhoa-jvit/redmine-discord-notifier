# Polling And Deduplication

## Polling Strategy

For each configured project, the poller stores a project watermark in SQLite.

Each poll cycle:

1. Reads `last_completed_watermark`.
2. Computes `updatedFrom = last_completed_watermark - POLL_OVERLAP_SECONDS`.
3. Queries Redmine issues updated since that date.
4. Filters issues in code to avoid processing changes outside the current poll window.
5. Fetches issue details with `include=journals` only for changed issues.
6. Detects journal-based events.
7. Updates issue state and project watermark after successful processing.

The Redmine `updated_on` query uses a date-only value (`YYYY-MM-DD`) for compatibility with older Redmine versions. The service then performs more precise filtering in code.

## Why Use An Overlap?

Polling systems can miss events if they query exactly from the previous timestamp. Causes include:

- clock skew,
- Redmine timestamp precision,
- pagination timing,
- changes happening during a poll.

The overlap makes the next poll re-scan a small recent window. Duplicate scanning is safe because event keys are deterministic and persisted.

## Journal Detection

The detector only processes journals newer than the project baseline and newer than the last seen journal id for that issue.

Event keys are deterministic:

```text
project:{projectId}:issue:{issueId}:created
project:{projectId}:issue:{issueId}:journal:{journalId}:comment
project:{projectId}:issue:{issueId}:journal:{journalId}:field:{fieldName}
```

These keys are stored in `notification_outbox.event_key`.

## Startup Baseline

On first startup for a project, the service records `baseline_at` and `last_completed_watermark`.

It does not send old historical activity. Only activity after the baseline is eligible for Discord notifications.

If you delete the SQLite database, the service will create a new baseline and treat that as a fresh installation.

## Restart Behavior

By default, `SKIP_MISSED_ON_START=true`.

When an already-initialized service starts again after downtime, it advances the project watermark to the service start time and ignores journals before that time. This prevents a burst of Discord messages for everything that happened while the service was offline.

Set `SKIP_MISSED_ON_START=false` if you prefer catch-up behavior.

## Discord Retry

Discord notifications are sent from `notification_outbox`.

If delivery fails:

- status becomes `failed`,
- `attempt_count` increments,
- `next_attempt_at` is set using exponential backoff.

The event stays in SQLite and is retried later.
