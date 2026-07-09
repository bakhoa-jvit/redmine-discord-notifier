# Project Guidelines

## Project goal

Build a Redmine REST API polling service that sends issue activity
notifications to Discord webhooks.

## Architecture principles

- One shared service must support multiple projects.
- Do not create one deployment per Redmine project.
- Redmine access is read-only.
- Do not require Redmine admin access.
- Do not require Redmine plugins.
- Secrets must never be committed.
- Persistence must prevent duplicate notifications after restart.
- Initial startup must not flood Discord with historical notifications.
- Prefer simple solutions over overengineering.

## Stack

- Node.js
- TypeScript
- SQLite for MVP
- Docker
- Discord Webhooks

## Development workflow

Before large changes:
1. inspect existing code
2. explain the intended change
3. keep changes scoped
4. run tests
5. run typecheck
6. report failures honestly