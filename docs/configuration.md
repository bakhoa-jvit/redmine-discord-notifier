# Configuration

The service uses two configuration layers:

- `.env` for runtime settings and shared secrets.
- `config/projects.json` for project routing when running locally.

Hosted platforms such as Railway can skip `config/projects.json` and use `PROJECTS_CONFIG_JSON` instead.

## Runtime Variables

```env
REDMINE_BASE_URL=https://redmine.example.com
REDMINE_API_KEY=replace_with_your_personal_api_key

PROJECTS_CONFIG_FILE=./config/projects.json

POLL_INTERVAL_SECONDS=60
POLL_OVERLAP_SECONDS=120
REDMINE_PAGE_LIMIT=100
MAX_ISSUE_DETAIL_REQUESTS_PER_CYCLE=200
SKIP_MISSED_ON_START=true
SQLITE_PATH=./data/notifier.sqlite
STARTUP_MODE=baseline
LOG_LEVEL=info
```

## Project Routing File

Create it from the example:

```bash
cp config/projects.example.json config/projects.json
```

Example:

```json
[
  {
    "id": "data-index",
    "discordWebhookUrl": "https://discord.com/api/webhooks/...",
    "events": ["comment_added", "status_changed"]
  }
]
```

Supported event types:

- `issue_created`
- `comment_added`
- `status_changed`
- `assignee_changed`
- `priority_changed`

If `events` is omitted, all event types are enabled.

## Tagging the Assignee on Discord

Redmine only exposes a user's display name, not their Discord account, so pinging the assignee requires an explicit per-project mapping from Redmine user id to Discord user id (snowflake):

```json
[
  {
    "id": "data-index",
    "discordWebhookUrl": "https://discord.com/api/webhooks/...",
    "events": ["comment_added", "status_changed"],
    "assigneeDiscordIds": {
      "7": "123456789012345678",
      "8": { "discordId": "234567890123456789", "note": "Le Dong" }
    }
  }
]
```

- Keys are Redmine user ids (as they appear in `assigned_to.id` on an issue).
- Values can be either a plain Discord user id string, or an object `{ "discordId": "...", "note": "..." }` — `note` is ignored by the app and is only there so the mapping is self-documenting (JSON has no comment syntax, so this is the supported way to label which entry belongs to whom).
- To find a Discord user id, enable Developer Mode in Discord (User Settings > Advanced) and use "Copy User ID" on their profile.
- The mention is sent in the webhook `content` field (not inside the embed), since Discord only delivers a real ping/notification for mentions placed there. `allowed_mentions` is scoped to that exact user id, so nothing else in the message can trigger an unintended ping.
- If the current assignee has no entry in `assigneeDiscordIds` (or the issue has no assignee), the notification is sent as plain text with no mention — this is a silent fallback, not an error. The same applies if the mapped Discord id is no longer a member of the server: Discord just renders it as an unresolved mention without pinging anyone or failing the webhook call.
- `assigneeDiscordIds` is optional and defaults to empty (no mentions) when omitted.

## Railway JSON Variable

For Railway, set this as a service variable instead of committing `config/projects.json`:

```env
PROJECTS_CONFIG_JSON=[{"id":"data-index","discordWebhookUrl":"https://discord.com/api/webhooks/...","events":["comment_added","status_changed"]}]
```

`PROJECTS_CONFIG_JSON` takes priority over `PROJECTS_CONFIG_FILE`.

## Restart Catch-Up Behavior

By default, the service does not send notifications for activity that happened while it was stopped:

```env
SKIP_MISSED_ON_START=true
```

This prevents Discord spam after downtime. To catch up missed Redmine activity after restart, set:

```env
SKIP_MISSED_ON_START=false
```
