import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/state/database.js";
import { ConfigRepository, ValidationError } from "../src/state/configRepository.js";

test("creates, lists, updates and deletes a project", () => {
  const db = openDatabase(":memory:");
  const repo = new ConfigRepository(db);

  repo.createProject({ id: "data-index", webhookUrl: "https://discord.com/api/webhooks/1/abc", events: ["comment_added"] });
  assert.equal(repo.listProjects().length, 1);
  assert.deepEqual(repo.getProject("data-index")?.events, ["comment_added"]);

  repo.updateProject("data-index", {
    webhookUrl: "https://discord.com/api/webhooks/1/def",
    events: ["comment_added", "status_changed"],
  });
  assert.equal(repo.getProject("data-index")?.webhookUrl, "https://discord.com/api/webhooks/1/def");
  assert.deepEqual(repo.getProject("data-index")?.events, ["comment_added", "status_changed"]);

  repo.deleteProject("data-index");
  assert.equal(repo.getProject("data-index"), null);
  db.close();
});

test("rejects a duplicate project id", () => {
  const db = openDatabase(":memory:");
  const repo = new ConfigRepository(db);
  repo.createProject({ id: "data-index", webhookUrl: "https://discord.com/api/webhooks/1/abc", events: ["comment_added"] });

  assert.throws(
    () => repo.createProject({ id: "data-index", webhookUrl: "https://discord.com/api/webhooks/1/other", events: ["comment_added"] }),
    ValidationError,
  );
  db.close();
});

test("rejects an invalid project id", () => {
  const db = openDatabase(":memory:");
  const repo = new ConfigRepository(db);
  assert.throws(
    () => repo.createProject({ id: "Has Spaces", webhookUrl: "https://discord.com/api/webhooks/1/abc", events: ["comment_added"] }),
    ValidationError,
  );
  db.close();
});

test("rejects a non-Discord webhook URL", () => {
  const db = openDatabase(":memory:");
  const repo = new ConfigRepository(db);
  assert.throws(
    () => repo.createProject({ id: "data-index", webhookUrl: "https://evil.example.com/hook", events: ["comment_added"] }),
    ValidationError,
  );
  db.close();
});

test("rejects an unsupported event type", () => {
  const db = openDatabase(":memory:");
  const repo = new ConfigRepository(db);
  assert.throws(
    () => repo.createProject({ id: "data-index", webhookUrl: "https://discord.com/api/webhooks/1/abc", events: ["not-a-real-event"] }),
    ValidationError,
  );
  db.close();
});

test("rejects an empty events list", () => {
  const db = openDatabase(":memory:");
  const repo = new ConfigRepository(db);
  assert.throws(
    () => repo.createProject({ id: "data-index", webhookUrl: "https://discord.com/api/webhooks/1/abc", events: [] }),
    ValidationError,
  );
  db.close();
});

test("updateProject rejects an unknown project id", () => {
  const db = openDatabase(":memory:");
  const repo = new ConfigRepository(db);
  assert.throws(
    () => repo.updateProject("missing", { webhookUrl: "https://discord.com/api/webhooks/1/abc", events: ["comment_added"] }),
    ValidationError,
  );
  db.close();
});
