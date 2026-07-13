import test from "node:test";
import assert from "node:assert/strict";
import { initializeNewProjects, Poller } from "../src/poller.js";
import { openDatabase } from "../src/state/database.js";
import { ConfigRepository } from "../src/state/configRepository.js";
import { OutboxRepository, StateRepository } from "../src/state/repositories.js";
import { Logger } from "../src/logger.js";
import type { AppConfig } from "../src/config.js";
import type { RedmineClient } from "../src/redmine/client.js";
import type { RedmineIssueListResponse, RedmineNamedRef } from "../src/redmine/types.js";

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

test("pollOnce refreshes reference data only on cycles where a new project appears", async () => {
  const db = openDatabase(":memory:");
  const configRepository = new ConfigRepository(db);
  const state = new StateRepository(db);
  const outbox = new OutboxRepository(db);
  const logger = new Logger("error");

  let refreshCalls = 0;
  const redmine = createFakeRedmineClient({
    listIssueStatuses: async () => {
      refreshCalls += 1;
      return [];
    },
  });

  const poller = new Poller(createTestConfig(), redmine, configRepository, state, outbox, logger);

  configRepository.createProject({
    id: "data-index",
    webhookUrl: "https://discord.com/api/webhooks/1/a",
    events: ["comment_added"],
  });
  await poller.pollOnce();
  assert.equal(refreshCalls, 1, "expected a refresh when data-index is first seen");

  await poller.pollOnce();
  assert.equal(refreshCalls, 1, "expected no refresh when no new project appears");

  configRepository.createProject({
    id: "another-project",
    webhookUrl: "https://discord.com/api/webhooks/2/b",
    events: ["comment_added"],
  });
  await poller.pollOnce();
  assert.equal(refreshCalls, 2, "expected a refresh when another-project is first seen");

  db.close();
});

function createFakeRedmineClient(overrides: Partial<RedmineClient> = {}): RedmineClient {
  const emptyIssueList: RedmineIssueListResponse = { issues: [], total_count: 0, offset: 0, limit: 100 };
  const noRefs: RedmineNamedRef[] = [];
  return {
    listChangedIssues: async () => emptyIssueList,
    getIssueWithJournals: async () => {
      throw new Error("not stubbed in this fake");
    },
    issueUrl: (issueId: number) => `https://redmine.example.com/issues/${issueId}`,
    listIssueStatuses: async () => noRefs,
    listIssuePriorities: async () => noRefs,
    ...overrides,
  } as unknown as RedmineClient;
}

function createTestConfig(): AppConfig {
  return {
    redmineBaseUrl: "https://redmine.example.com",
    redmineApiKey: "test-key",
    pollIntervalMs: 60000,
    pollOverlapMs: 120000,
    redminePageLimit: 100,
    maxIssueDetailRequestsPerCycle: 200,
    skipMissedOnStart: true,
    sqlitePath: ":memory:",
    startupMode: "baseline",
    logLevel: "error",
    adminPort: 3000,
    adminSessionSecret: "test-session-secret",
    adminUsername: "admin",
    adminPassword: "test-admin-password",
  };
}
