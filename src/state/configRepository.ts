import type { SqliteDatabase } from "./database.js";
import { nowIso } from "../time.js";

export type EventType =
  | "issue_created"
  | "comment_added"
  | "status_changed"
  | "assignee_changed"
  | "priority_changed";

const allEventTypes: EventType[] = [
  "issue_created",
  "comment_added",
  "status_changed",
  "assignee_changed",
  "priority_changed",
];

const projectIdPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface ProjectConfig {
  id: string;
  webhookUrl: string;
  events: EventType[];
}

export class ValidationError extends Error {}

interface ProjectRow {
  id: string;
  discord_webhook_url: string;
  events_json: string;
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
