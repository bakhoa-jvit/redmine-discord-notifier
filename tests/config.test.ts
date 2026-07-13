import test from "node:test";
import assert from "node:assert/strict";
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
  ADMIN_SESSION_SECRET: "test-session-secret",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "test-admin-password",
};

test("loads runtime config from env", () => {
  const config = loadConfig(baseEnv);

  assert.equal(config.redmineBaseUrl, "https://redmine.example.com");
  assert.equal(config.redmineApiKey, "secret");
  assert.equal(config.pollIntervalMs, 30000);
  assert.equal(config.pollOverlapMs, 90000);
  assert.equal(config.redminePageLimit, 50);
  assert.equal(config.maxIssueDetailRequestsPerCycle, 25);
  assert.equal(config.skipMissedOnStart, true);
  assert.equal(config.sqlitePath, "./data/test.sqlite");
  assert.equal(config.logLevel, "debug");
  assert.equal(config.adminPort, 3000);
  assert.equal(config.adminSessionSecret, "test-session-secret");
  assert.equal(config.adminUsername, "admin");
  assert.equal(config.adminPassword, "test-admin-password");
});

test("can enable catch-up on service start", () => {
  const config = loadConfig({ ...baseEnv, SKIP_MISSED_ON_START: "false" });
  assert.equal(config.skipMissedOnStart, false);
});

test("parses a custom ADMIN_PORT", () => {
  const config = loadConfig({ ...baseEnv, ADMIN_PORT: "8080" });
  assert.equal(config.adminPort, 8080);
});

test("rejects missing REDMINE_API_KEY", () => {
  assert.throws(
    () => loadConfig({ REDMINE_BASE_URL: "https://redmine.example.com" }),
    /REDMINE_API_KEY/,
  );
});

test("rejects missing ADMIN_SESSION_SECRET", () => {
  const { ADMIN_SESSION_SECRET, ...rest } = baseEnv;
  assert.throws(() => loadConfig(rest), /ADMIN_SESSION_SECRET/);
});

test("rejects missing ADMIN_USERNAME", () => {
  const { ADMIN_USERNAME, ...rest } = baseEnv;
  assert.throws(() => loadConfig(rest), /ADMIN_USERNAME/);
});

test("rejects missing ADMIN_PASSWORD", () => {
  const { ADMIN_PASSWORD, ...rest } = baseEnv;
  assert.throws(() => loadConfig(rest), /ADMIN_PASSWORD/);
});
