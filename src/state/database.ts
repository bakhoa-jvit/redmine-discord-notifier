import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

export function openDatabase(path: string): SqliteDatabase {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects_state (
      project_id TEXT PRIMARY KEY,
      initialized INTEGER NOT NULL,
      baseline_at TEXT,
      last_completed_watermark TEXT,
      last_poll_started_at TEXT,
      last_poll_finished_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS issues_state (
      project_id TEXT NOT NULL,
      issue_id INTEGER NOT NULL,
      last_seen_updated_on TEXT NOT NULL,
      last_seen_journal_id INTEGER,
      first_seen_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (project_id, issue_id)
    );

    CREATE TABLE IF NOT EXISTS notification_outbox (
      event_key TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      issue_id INTEGER NOT NULL,
      journal_id INTEGER,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      last_error TEXT,
      detected_at TEXT NOT NULL,
      sent_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_due
      ON notification_outbox (status, next_attempt_at);

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      discord_webhook_url TEXT NOT NULL,
      events_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignee_discord_ids (
      redmine_user_id INTEGER PRIMARY KEY,
      discord_id TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
