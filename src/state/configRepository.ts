import type { SqliteDatabase } from "./database.js";
import { nowIso } from "../time.js";
import { allEventTypes, type EventType, type ProjectConfig } from "../config.js";

const projectIdPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const discordSnowflakePattern = /^\d{15,25}$/;

export interface AssigneeMapping {
  redmineUserId: number;
  discordId: string;
  note: string | null;
}

export class ValidationError extends Error {}

interface ProjectRow {
  id: string;
  discord_webhook_url: string;
  events_json: string;
}

interface AssigneeRow {
  redmine_user_id: number;
  discord_id: string;
  note: string | null;
}

export class ConfigRepository {
  constructor(private readonly db: SqliteDatabase) {}

  listProjects(): ProjectConfig[] {
    const rows = this.db
      .prepare("SELECT id, discord_webhook_url, events_json FROM projects ORDER BY id")
      .all() as ProjectRow[];
    return rows.map(rowToProject);
  }

  getProject(id: string): ProjectConfig | null {
    const row = this.db
      .prepare("SELECT id, discord_webhook_url, events_json FROM projects WHERE id = ?")
      .get(id) as ProjectRow | undefined;
    return row ? rowToProject(row) : null;
  }

  createProject(input: { id: string; webhookUrl: string; events: string[] }): void {
    const id = validateProjectId(input.id);
    const webhookUrl = validateWebhookUrl(input.webhookUrl);
    const events = validateEvents(input.events);
    if (this.getProject(id)) {
      throw new ValidationError(`Project id already exists: ${id}`);
    }
    const now = nowIso();
    this.db
      .prepare(
        "INSERT INTO projects (id, discord_webhook_url, events_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, webhookUrl, JSON.stringify(events), now, now);
  }

  updateProject(id: string, input: { webhookUrl: string; events: string[] }): void {
    if (!this.getProject(id)) {
      throw new ValidationError(`Project not found: ${id}`);
    }
    const webhookUrl = validateWebhookUrl(input.webhookUrl);
    const events = validateEvents(input.events);
    this.db
      .prepare("UPDATE projects SET discord_webhook_url = ?, events_json = ?, updated_at = ? WHERE id = ?")
      .run(webhookUrl, JSON.stringify(events), nowIso(), id);
  }

  deleteProject(id: string): void {
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }

  listAssignees(): AssigneeMapping[] {
    const rows = this.db
      .prepare("SELECT redmine_user_id, discord_id, note FROM assignee_discord_ids ORDER BY redmine_user_id")
      .all() as AssigneeRow[];
    return rows.map((row) => ({ redmineUserId: row.redmine_user_id, discordId: row.discord_id, note: row.note }));
  }

  getAssigneeDiscordIds(): Map<number, string> {
    const result = new Map<number, string>();
    for (const row of this.listAssignees()) {
      result.set(row.redmineUserId, row.discordId);
    }
    return result;
  }

  upsertAssignee(input: { redmineUserId: number; discordId: string; note: string | null }): void {
    const redmineUserId = validateRedmineUserId(input.redmineUserId);
    const discordId = validateDiscordId(input.discordId);
    const now = nowIso();
    this.db
      .prepare(
        `INSERT INTO assignee_discord_ids (redmine_user_id, discord_id, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(redmine_user_id) DO UPDATE SET
           discord_id = excluded.discord_id,
           note = excluded.note,
           updated_at = excluded.updated_at`,
      )
      .run(redmineUserId, discordId, input.note, now, now);
  }

  deleteAssignee(redmineUserId: number): void {
    this.db.prepare("DELETE FROM assignee_discord_ids WHERE redmine_user_id = ?").run(redmineUserId);
  }
}

function rowToProject(row: ProjectRow): ProjectConfig {
  return {
    id: row.id,
    webhookUrl: row.discord_webhook_url,
    events: JSON.parse(row.events_json) as EventType[],
  };
}

function validateProjectId(id: string): string {
  const trimmed = id.trim();
  if (!projectIdPattern.test(trimmed)) {
    throw new ValidationError(
      "Project id must be lowercase letters, digits, and hyphens only (max 64 characters)",
    );
  }
  return trimmed;
}

function validateWebhookUrl(url: string): string {
  const trimmed = url.trim();
  if (
    !trimmed.startsWith("https://discord.com/api/webhooks/") &&
    !trimmed.startsWith("https://discordapp.com/api/webhooks/")
  ) {
    throw new ValidationError("Discord webhook URL must start with https://discord.com/api/webhooks/");
  }
  return trimmed;
}

function validateEvents(events: string[]): EventType[] {
  if (events.length === 0) {
    throw new ValidationError("At least one event type must be selected");
  }
  return events.map((event) => {
    if (!allEventTypes.includes(event as EventType)) {
      throw new ValidationError(`Unsupported event type: ${event}`);
    }
    return event as EventType;
  });
}

function validateRedmineUserId(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError("Redmine user id must be a positive integer");
  }
  return value;
}

function validateDiscordId(value: string): string {
  const trimmed = value.trim();
  if (!discordSnowflakePattern.test(trimmed)) {
    throw new ValidationError("Discord id must be a numeric snowflake (15-25 digits)");
  }
  return trimmed;
}
