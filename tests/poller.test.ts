import test from "node:test";
import assert from "node:assert/strict";
import { initializeNewProjects } from "../src/poller.js";
import { openDatabase } from "../src/state/database.js";
import { StateRepository } from "../src/state/repositories.js";
import { Logger } from "../src/logger.js";

test("initializes a brand-new project without touching an already-running project's watermark", () => {
  const db = openDatabase(":memory:");
  const state = new StateRepository(db);
  const logger = new Logger("error");

  state.initializeProject("existing-project", "2026-01-01T00:00:00.000Z");
  state.completePoll("existing-project", "2026-06-01T00:00:00.000Z");

  initializeNewProjects(
    [
      { id: "existing-project", webhookUrl: "https://discord.com/api/webhooks/1/a", events: ["comment_added"] },
      { id: "new-project", webhookUrl: "https://discord.com/api/webhooks/2/b", events: ["comment_added"] },
    ],
    state,
    logger,
  );

  const existing = state.getProject("existing-project");
  assert.equal(existing?.lastCompletedWatermark, "2026-06-01T00:00:00.000Z");

  const created = state.getProject("new-project");
  assert.equal(created?.initialized, true);
  assert.equal(typeof created?.baselineAt, "string");

  db.close();
});

test("is a no-op when every project is already initialized", () => {
  const db = openDatabase(":memory:");
  const state = new StateRepository(db);
  const logger = new Logger("error");

  state.initializeProject("existing-project", "2026-01-01T00:00:00.000Z");
  state.completePoll("existing-project", "2026-06-01T00:00:00.000Z");

  initializeNewProjects(
    [{ id: "existing-project", webhookUrl: "https://discord.com/api/webhooks/1/a", events: ["comment_added"] }],
    state,
    logger,
  );

  assert.equal(state.getProject("existing-project")?.lastCompletedWatermark, "2026-06-01T00:00:00.000Z");
  db.close();
});
