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
  assert.equal(config.sqlitePath, "./data/test.sqlite");
  assert.equal(config.logLevel, "debug");
  assert.equal(config.projects.length, 2);
  assert.deepEqual(config.projects[0]?.events, ["comment_added", "status_changed"]);
  assert.equal(config.projects[1]?.events.includes("issue_created"), true);
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
