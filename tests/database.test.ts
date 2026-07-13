import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/state/database.js";

test("creates admin_users, projects, and assignee_discord_ids tables", () => {
  const db = openDatabase(":memory:");

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => (row as { name: string }).name);

  assert.ok(tables.includes("admin_users"));
  assert.ok(tables.includes("projects"));
  assert.ok(tables.includes("assignee_discord_ids"));

  db.prepare(
    "INSERT INTO admin_users (username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?)",
  ).run("admin", "hash", "2026-07-13T00:00:00.000Z", "2026-07-13T00:00:00.000Z");
  db.prepare(
    "INSERT INTO projects (id, discord_webhook_url, events_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("data-index", "https://discord.com/api/webhooks/1/abc", "[]", "2026-07-13T00:00:00.000Z", "2026-07-13T00:00:00.000Z");
  db.prepare(
    "INSERT INTO assignee_discord_ids (redmine_user_id, discord_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run(7, "123456789012345678", "Ba Khoa", "2026-07-13T00:00:00.000Z", "2026-07-13T00:00:00.000Z");

  db.close();
});
