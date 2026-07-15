export type EventType =
  | "issue_created"
  | "comment_added"
  | "status_changed"
  | "assignee_changed"
  | "priority_changed";

export const allEventTypes: EventType[] = [
  "issue_created",
  "comment_added",
  "status_changed",
  "assignee_changed",
  "priority_changed",
];

export interface ProjectConfig {
  id: string;
  webhookUrl: string;
  events: EventType[];
}

export interface AppConfig {
  redmineBaseUrl: string;
  redmineApiKey: string;
  pollIntervalMs: number;
  pollOverlapMs: number;
  redminePageLimit: number;
  maxIssueDetailRequestsPerCycle: number;
  skipMissedOnStart: boolean;
  sqlitePath: string;
  startupMode: "baseline";
  logLevel: "debug" | "info" | "warn" | "error";
  adminPort: number;
  adminSessionSecret: string;
  adminUsername: string;
  adminPassword: string;
  dataCleanupAfterMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const startupMode = parseStartupMode(env.STARTUP_MODE || "baseline");
  const sqlitePath = env.SQLITE_PATH || "./data/notifier.sqlite";
  const logLevel = parseLogLevel(env.LOG_LEVEL || "info");

  return {
    redmineBaseUrl: trimTrailingSlash(requireEnv(env, "REDMINE_BASE_URL")),
    redmineApiKey: requireEnv(env, "REDMINE_API_KEY"),
    pollIntervalMs: parsePositiveInt(env.POLL_INTERVAL_SECONDS, 60, "POLL_INTERVAL_SECONDS") * 1000,
    pollOverlapMs: parsePositiveInt(env.POLL_OVERLAP_SECONDS, 120, "POLL_OVERLAP_SECONDS") * 1000,
    redminePageLimit: parsePositiveInt(env.REDMINE_PAGE_LIMIT, 100, "REDMINE_PAGE_LIMIT"),
    maxIssueDetailRequestsPerCycle: parsePositiveInt(
      env.MAX_ISSUE_DETAIL_REQUESTS_PER_CYCLE,
      200,
      "MAX_ISSUE_DETAIL_REQUESTS_PER_CYCLE",
    ),
    skipMissedOnStart: parseBoolean(env.SKIP_MISSED_ON_START, true, "SKIP_MISSED_ON_START"),
    sqlitePath,
    startupMode,
    logLevel,
    adminPort: parsePositiveInt(env.ADMIN_PORT, 3000, "ADMIN_PORT"),
    adminSessionSecret: requireEnv(env, "ADMIN_SESSION_SECRET"),
    adminUsername: requireEnv(env, "ADMIN_USERNAME"),
    adminPassword: requireEnv(env, "ADMIN_PASSWORD"),
    dataCleanupAfterMs: parsePositiveInt(env.DATA_CLEANUP_AFTER_SECONDS, 2592000, "DATA_CLEANUP_AFTER_SECONDS") * 1000,
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

function parsePositiveInt(value: string | undefined, fallback: number, name: string): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}

function parseStartupMode(value: unknown): AppConfig["startupMode"] {
  if (value === "baseline") {
    return value;
  }
  throw new Error("Only startupMode=baseline is supported in the MVP");
}

function parseLogLevel(value: string): AppConfig["logLevel"] {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  throw new Error(`Unsupported LOG_LEVEL: ${value}`);
}
