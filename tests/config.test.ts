import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";

const baseEnv = {
  REDMINE_BASE_URL: "https://redmine.example.com/",
  REDMINE_API_KEY: "secret",
  SQLITE_PATH: "./data/test.sqlite",
  POLL_INTERVAL_SECONDS: "30",
  POLL_OVERLAP_SECONDS: "90",
  REDMINE_PAGE_LIMIT: "50",
  MAX_ISSUE_DETAIL_REQUESTS_PER_CYCLE: "25",
  SKIP_MISSED_ON_START: "true",
  STARTUP_MODE: "baseline",
  LOG_LEVEL: "debug",
};

test("loads runtime config from env and projects from JSON file", () => {
  const path = writeProjects("projects.json", [
    {
      id: "data-index",
      discordWebhookUrl: "https://discord.com/api/webhooks/data",
      events: ["comment_added", "status_changed"],
    },
    {
      id: "doctor-health",
      discordWebhookUrl: "https://discord.com/api/webhooks/doctor",
    },
  ]);

  const config = loadConfig({ ...baseEnv, PROJECTS_CONFIG_FILE: path });

  assert.equal(config.redmineBaseUrl, "https://redmine.example.com");
  assert.equal(config.redmineApiKey, "secret");
  assert.equal(config.pollIntervalMs, 30000);
  assert.equal(config.pollOverlapMs, 90000);
  assert.equal(config.redminePageLimit, 50);
  assert.equal(config.maxIssueDetailRequestsPerCycle, 25);
  assert.equal(config.skipMissedOnStart, true);
  assert.equal(config.sqlitePath, "./data/test.sqlite");
  assert.equal(config.logLevel, "debug");
  assert.equal(config.projects.length, 2);
  assert.deepEqual(config.projects[0]?.events, ["comment_added", "status_changed"]);
  assert.equal(config.projects[1]?.events.includes("issue_created"), true);
});

test("can enable catch-up on service start", () => {
  const path = writeProjects("catch-up-projects.json", [
    { id: "data-index", discordWebhookUrl: "https://discord.com/api/webhooks/data" },
  ]);

  const config = loadConfig({
    ...baseEnv,
    SKIP_MISSED_ON_START: "false",
    PROJECTS_CONFIG_FILE: path,
  });

  assert.equal(config.skipMissedOnStart, false);
});

test("loads projects from PROJECTS_CONFIG_JSON before file", () => {
  const filePath = writeProjects("ignored-projects.json", [
    { id: "from-file", discordWebhookUrl: "https://discord.com/api/webhooks/file" },
  ]);

  const config = loadConfig({
    ...baseEnv,
    PROJECTS_CONFIG_FILE: filePath,
    PROJECTS_CONFIG_JSON: JSON.stringify([
      {
        id: "from-env",
        discordWebhookUrl: "https://discord.com/api/webhooks/env",
        events: ["comment_added"],
      },
    ]),
  });

  assert.equal(config.projects.length, 1);
  assert.equal(config.projects[0]?.id, "from-env");
  assert.deepEqual(config.projects[0]?.events, ["comment_added"]);
});

test("loads assigneeDiscordIds mapping, defaulting to empty when omitted", () => {
  const path = writeProjects("assignee-map-projects.json", [
    {
      id: "data-index",
      discordWebhookUrl: "https://discord.com/api/webhooks/data",
      assigneeDiscordIds: { "7": "123456789012345678" },
    },
    { id: "doctor-health", discordWebhookUrl: "https://discord.com/api/webhooks/doctor" },
  ]);

  const config = loadConfig({ ...baseEnv, PROJECTS_CONFIG_FILE: path });

  assert.equal(config.projects[0]?.assigneeDiscordIds.get(7), "123456789012345678");
  assert.equal(config.projects[1]?.assigneeDiscordIds.size, 0);
});

test("loads assigneeDiscordIds entries written as { discordId, note } objects", () => {
  const path = writeProjects("assignee-map-object-projects.json", [
    {
      id: "data-index",
      discordWebhookUrl: "https://discord.com/api/webhooks/data",
      assigneeDiscordIds: {
        "7": "123456789012345678",
        "8": { discordId: "234567890123456789", note: "Le Dong" },
      },
    },
  ]);

  const config = loadConfig({ ...baseEnv, PROJECTS_CONFIG_FILE: path });

  assert.equal(config.projects[0]?.assigneeDiscordIds.get(7), "123456789012345678");
  assert.equal(config.projects[0]?.assigneeDiscordIds.get(8), "234567890123456789");
});

test("rejects an assigneeDiscordIds object entry missing discordId", () => {
  const path = writeProjects("assignee-map-object-missing.json", [
    {
      id: "data-index",
      discordWebhookUrl: "https://discord.com/api/webhooks/data",
      assigneeDiscordIds: { "8": { note: "Le Dong" } },
    },
  ]);

  assert.throws(
    () => loadConfig({ ...baseEnv, PROJECTS_CONFIG_FILE: path }),
    /assigneeDiscordIds\["8"\] must be a Discord user id/,
  );
});

test("rejects a non-numeric Discord id in assigneeDiscordIds", () => {
  const path = writeProjects("invalid-assignee-map.json", [
    {
      id: "data-index",
      discordWebhookUrl: "https://discord.com/api/webhooks/data",
      assigneeDiscordIds: { "7": "not-a-snowflake" },
    },
  ]);

  assert.throws(
    () => loadConfig({ ...baseEnv, PROJECTS_CONFIG_FILE: path }),
    /assigneeDiscordIds\["7"\] must be a Discord user id/,
  );
});

test("rejects a non-numeric Redmine user id key in assigneeDiscordIds", () => {
  const path = writeProjects("invalid-assignee-key.json", [
    {
      id: "data-index",
      discordWebhookUrl: "https://discord.com/api/webhooks/data",
      assigneeDiscordIds: { abc: "123456789012345678" },
    },
  ]);

  assert.throws(
    () => loadConfig({ ...baseEnv, PROJECTS_CONFIG_FILE: path }),
    /assigneeDiscordIds key "abc" must be a positive Redmine user id/,
  );
});

test("rejects duplicate project ids", () => {
  const path = writeProjects("duplicate-projects.json", [
    { id: "data-index", discordWebhookUrl: "https://discord.com/api/webhooks/data" },
    { id: "data-index", discordWebhookUrl: "https://discord.com/api/webhooks/doctor" },
  ]);

  assert.throws(() => loadConfig({ ...baseEnv, PROJECTS_CONFIG_FILE: path }), /Duplicate project id/);
});

test("rejects invalid project event", () => {
  const path = writeProjects("invalid-event.json", [
    {
      id: "data-index",
      discordWebhookUrl: "https://discord.com/api/webhooks/data",
      events: ["comment_added", "unsupported"],
    },
  ]);

  assert.throws(() => loadConfig({ ...baseEnv, PROJECTS_CONFIG_FILE: path }), /Unsupported event type/);
});

test("rejects missing Redmine API key env", () => {
  const path = writeProjects("missing-api-key.json", [
    { id: "data-index", discordWebhookUrl: "https://discord.com/api/webhooks/data" },
  ]);

  assert.throws(
    () =>
      loadConfig({
        REDMINE_BASE_URL: "https://redmine.example.com",
        PROJECTS_CONFIG_FILE: path,
      }),
    /REDMINE_API_KEY/,
  );
});

function writeProjects(name: string, value: unknown): string {
  const dir = "data/test-config";
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(value));
  return path;
}
