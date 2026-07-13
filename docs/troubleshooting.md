# Troubleshooting

## Redmine 404 for a project

Example:

```text
Redmine request failed: 404 Not Found ... project_id=another-project
```

The project id is wrong, the project does not exist, or the API key cannot access it. Check the project entry in the admin UI.

## Redmine DNS failure

Example:

```text
getaddrinfo ENOTFOUND redmine.example.com
```

The app is still using the example URL. Set `REDMINE_BASE_URL` to the real Redmine URL and redeploy/restart.

## Redmine updated_on invalid

Some Redmine versions only accept date-only filters for `updated_on`. The app already queries Redmine using `YYYY-MM-DD` and then filters more precisely in code.

## Discord webhook exposed

If a webhook URL appears in logs, chat, or a public repo, delete/rotate it in Discord and create a new webhook URL.

## Historical spam concern

The default `STARTUP_MODE=baseline` prevents old issue history from being sent on first startup. Only activity after baseline is notified.
