import { readFileSync } from "node:fs";

export type EventType =
  | "issue_created"
  | "comment_added"
  | "status_changed"
  | "assignee_changed"
  | "priority_changed";

export interface ProjectConfig {
  id: string;
  webhookUrl: string;
  events: EventType[];
  assigneeDiscordIds: Map<number, string>;
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
  projects: ProjectConfig[];
}

const defaultEvents: EventType[] = [
  "issue_created",
  "comment_added",
  "status_changed",
  "assignee_changed",
  "priority_changed",
];

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
    projects: loadProjects(env),
  };
}

function loadProjects(env: NodeJS.ProcessEnv): ProjectConfig[] {
  if (env.PROJECTS_CONFIG_JSON && env.PROJECTS_CONFIG_JSON.trim() !== "") {
    return parseProjectsJson(env.PROJECTS_CONFIG_JSON, "PROJECTS_CONFIG_JSON");
  }

  const projectsConfigPath = env.PROJECTS_CONFIG_FILE?.trim() || "./config/projects.json";
  return parseProjectsFile(projectsConfigPath);
}

function parseProjectsFile(path: string): ProjectConfig[] {
  let value: string;
  try {
    value = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(
      `Cannot read projects config file ${path}. Copy config/projects.example.json to config/projects.json first. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return parseProjectsJson(value, path);
}

function parseProjectsJson(value: string, source: string): ProjectConfig[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error(
      `${source} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseProjects(parsed, source);
}

interface RawProjectConfig {
  id?: unknown;
  discordWebhookUrl?: unknown;
  events?: unknown;
  assigneeDiscordIds?: unknown;
}

function parseProjects(value: unknown, source: string): ProjectConfig[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${source} must be a non-empty array`);
  }

  const seenProjectIds = new Set<string>();
  return value.map((raw, index) => {
    const project = raw as RawProjectConfig;
    if (!project || typeof project !== "object") {
      throw new Error(`${source}.projects[${index}] must be an object`);
    }
    if (typeof project.id !== "string" || project.id.trim() === "") {
      throw new Error(`${source}.projects[${index}].id must be a non-empty string`);
    }
    if (typeof project.discordWebhookUrl !== "string" || project.discordWebhookUrl.trim() === "") {
      throw new Error(`${source}.projects[${index}].discordWebhookUrl must be a non-empty string`);
    }

    const id = project.id.trim();
    if (seenProjectIds.has(id)) {
      throw new Error(`Duplicate project id in ${source}: ${id}`);
    }
    seenProjectIds.add(id);

    return {
      id,
      webhookUrl: project.discordWebhookUrl.trim(),
      events: parseProjectEvents(project.events, index, source),
      assigneeDiscordIds: parseAssigneeDiscordIds(project.assigneeDiscordIds, index, source),
    };
  });
}

function parseProjectEvents(value: unknown, index: number, source: string): EventType[] {
  if (value === undefined || value === null) {
    return defaultEvents;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${source}.projects[${index}].events must be an array`);
  }

  const allowed = new Set<EventType>(defaultEvents);
  const events = value.map((event) => {
    if (typeof event !== "string" || event.trim() === "") {
      throw new Error(`${source}.projects[${index}].events must contain strings`);
    }
    const trimmed = event.trim();
    if (!allowed.has(trimmed as EventType)) {
      throw new Error(`Unsupported event type in ${source}.projects[${index}].events: ${trimmed}`);
    }
    return trimmed as EventType;
  });

  return events;
}

const discordSnowflakePattern = /^\d{15,25}$/;

function parseAssigneeDiscordIds(value: unknown, index: number, source: string): Map<number, string> {
  if (value === undefined || value === null) {
    return new Map();
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source}.projects[${index}].assigneeDiscordIds must be an object`);
  }

  const result = new Map<number, string>();
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const redmineUserId = Number.parseInt(key, 10);
    if (!Number.isInteger(redmineUserId) || redmineUserId <= 0 || String(redmineUserId) !== key.trim()) {
      throw new Error(
        `${source}.projects[${index}].assigneeDiscordIds key "${key}" must be a positive Redmine user id`,
      );
    }
    const discordId = extractDiscordId(raw);
    if (!discordId || !discordSnowflakePattern.test(discordId)) {
      throw new Error(
        `${source}.projects[${index}].assigneeDiscordIds["${key}"] must be a Discord user id (numeric snowflake), ` +
          `either directly as a string or as { "discordId": "..." }`,
      );
    }
    result.set(redmineUserId, discordId);
  }
  return result;
}

function extractDiscordId(raw: unknown): string | null {
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const discordId = (raw as { discordId?: unknown }).discordId;
    if (typeof discordId === "string") {
      return discordId.trim();
    }
  }
  return null;
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
