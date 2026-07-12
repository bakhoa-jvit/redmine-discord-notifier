# Project Overview

Redmine Discord Notifier is a background service that watches Redmine issue activity and sends selected events to Discord channels through webhooks.

The service is designed for teams that cannot install a Redmine plugin or do not have Redmine admin access. It uses a personal or service Redmine API key and polls the Redmine REST API.

## Goals

- Poll Redmine periodically.
- Detect issue activity from Redmine issue journals.
- Send formatted Discord webhook notifications.
- Avoid duplicate notifications across polling overlaps and restarts.
- Persist enough state to survive service restarts.
- Avoid notification bursts after downtime by default.
- Support multiple Redmine projects from one shared service.
- Route each project to its own Discord webhook/channel.

## Non-Goals

- It is not a Redmine plugin.
- It does not require Redmine admin access.
- It does not expose a web UI yet.
- It does not edit or delete Discord messages.
- It does not mirror full Redmine data into the local database.

## Supported Events

- `issue_created`: a new issue was created after the project baseline.
- `comment_added`: a journal entry contains a non-empty note/comment.
- `status_changed`: a journal detail changed `status_id`.
- `assignee_changed`: a journal detail changed `assigned_to_id`.
- `priority_changed`: a journal detail changed `priority_id`.

## Runtime Model

The service runs continuously as one Node.js process:

```text
Redmine REST API
        |
        | polling
        v
Redmine Discord Notifier
        |
        |-- Poller
        |-- Journal/Event Detector
        |-- SQLite State + Outbox
        |-- Discord Formatter
        |-- Discord Webhook Client
        v
Discord channels/webhooks
```

One process can monitor multiple projects. Do not run one service per project.
