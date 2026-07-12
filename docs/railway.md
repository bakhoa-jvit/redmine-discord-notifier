# Railway Deployment

Railway can deploy this app from GitHub. Push to the connected branch, usually `main`, and Railway will build again automatically.

## Variables

Set these in Railway service variables:

```env
REDMINE_BASE_URL=http://redmine.jv-it.com.vn
REDMINE_API_KEY=your_key
PROJECTS_CONFIG_JSON=[{"id":"data-index","discordWebhookUrl":"https://discord.com/api/webhooks/...","events":["comment_added","status_changed"]}]
SQLITE_PATH=/app/data/notifier.sqlite
POLL_INTERVAL_SECONDS=60
POLL_OVERLAP_SECONDS=120
REDMINE_PAGE_LIMIT=100
MAX_ISSUE_DETAIL_REQUESTS_PER_CYCLE=200
SKIP_MISSED_ON_START=true
STARTUP_MODE=baseline
LOG_LEVEL=info
```

Do not set Railway's service Config File path to `.env`. That field is for `railway.json` or `railway.toml`, not app environment variables.

## Volume

Create a Railway Volume and mount it at:

```text
/app/data
```

Set:

```env
SQLITE_PATH=/app/data/notifier.sqlite
```

## Common Railway Errors

`service config at '.env' not found`

Clear the service Config File path in Railway settings. Variables should be managed in the Variables tab.

`PROJECTS_CONFIG_JSON must be valid JSON`

Paste the JSON as one complete array, without markdown fences or extra quotes:

```json
[{"id":"data-index","discordWebhookUrl":"https://discord.com/api/webhooks/...","events":["comment_added","status_changed"]}]
```

`Missing required environment variable: REDMINE_BASE_URL`

The deployment did not receive the variable. Check that it is set on the same Railway service and environment, then redeploy.
