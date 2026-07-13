# Railway Deployment

Railway can deploy this app from GitHub. Push to the connected branch,
usually `main`, and Railway will build again automatically.

## Variables

Set these in Railway service variables:

```env
REDMINE_BASE_URL=http://redmine.jv-it.com.vn
REDMINE_API_KEY=your_key
SQLITE_PATH=/app/data/notifier.sqlite
POLL_INTERVAL_SECONDS=60
POLL_OVERLAP_SECONDS=120
REDMINE_PAGE_LIMIT=100
MAX_ISSUE_DETAIL_REQUESTS_PER_CYCLE=200
SKIP_MISSED_ON_START=true
STARTUP_MODE=baseline
LOG_LEVEL=info
ADMIN_PORT=3000
ADMIN_SESSION_SECRET=a-long-random-string
ADMIN_USERNAME=admin
ADMIN_PASSWORD=a-strong-password
```

Do not set Railway's service Config File path to `.env`. That field is for
`railway.json` or `railway.toml`, not app environment variables.

Expose the service publicly (or via Railway's private networking) on
`ADMIN_PORT` to reach the admin UI at `/login`.

## Volume

Create a Railway Volume and mount it at:

```text
/app/data
```

Set:

```env
SQLITE_PATH=/app/data/notifier.sqlite
```

Project routing and the assignee mapping are stored in this SQLite file —
back up the volume before any migration.

## Managing Projects

Projects are no longer configured through a JSON file or env variable.
After the first deploy, open the admin UI (`/login` with
`ADMIN_USERNAME`/`ADMIN_PASSWORD`) and add projects and assignee mappings
there — changes apply on the next poll cycle without a redeploy.

## Common Railway Errors

`service config at '.env' not found`

Clear the service Config File path in Railway settings. Variables should
be managed in the Variables tab.

`Missing required environment variable: REDMINE_BASE_URL`

The deployment did not receive the variable. Check that it is set on the
same Railway service and environment, then redeploy.

`Missing required environment variable: ADMIN_SESSION_SECRET`

Set `ADMIN_SESSION_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` — all
three are required for the admin UI to boot.
