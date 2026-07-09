import type { SqliteDatabase } from "./database.js";
import { nowIso } from "../time.js";
import type { DetectedEvent } from "../events.js";
import type { DiscordWebhookPayload } from "../discord/formatter.js";

export interface ProjectState {
  projectId: string;
  initialized: boolean;
  baselineAt: string | null;
  lastCompletedWatermark: string | null;
}

export interface IssueState {
  projectId: string;
  issueId: number;
  lastSeenUpdatedOn: string;
  lastSeenJournalId: number | null;
}

export interface OutboxItem {
  eventKey: string;
  projectId: string;
  issueId: number;
  journalId: number | null;
  eventType: string;
  payload: DiscordWebhookPayload;
  attemptCount: number;
}

interface ProjectRow {
  project_id: string;
  initialized: number;
  baseline_at: string | null;
  last_completed_watermark: string | null;
}

interface IssueRow {
  project_id: string;
  issue_id: number;
  last_seen_updated_on: string;
  last_seen_journal_id: number | null;
}

interface OutboxRow {
  event_key: string;
  project_id: string;
  issue_id: number;
  journal_id: number | null;
  event_type: string;
  payload_json: string;
  attempt_count: number;
}

export class StateRepository {
  constructor(private readonly db: SqliteDatabase) {}

  getProject(projectId: string): ProjectState | null {
    const row = this.db
      .prepare("SELECT project_id, initialized, baseline_at, last_completed_watermark FROM projects_state WHERE project_id = ?")
      .get(projectId) as ProjectRow | undefined;
    if (!row) {
      return null;
    }
    return {
      projectId: row.project_id,
      initialized: row.initialized === 1,
      baselineAt: row.baseline_at,
      lastCompletedWatermark: row.last_completed_watermark,
    };
  }

  initializeProject(projectId: string, baselineAt: string): void {
    const now = nowIso();
    this.db
      .prepare(`
        INSERT INTO projects_state (
          project_id, initialized, baseline_at, last_completed_watermark,
          created_at, updated_at
        )
        VALUES (?, 1, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          initialized = 1,
          baseline_at = excluded.baseline_at,
          last_completed_watermark = excluded.last_completed_watermark,
          updated_at = excluded.updated_at
      `)
      .run(projectId, baselineAt, baselineAt, now, now);
  }

  markPollStarted(projectId: string, startedAt: string): void {
    this.db
      .prepare("UPDATE projects_state SET last_poll_started_at = ?, last_error = NULL, updated_at = ? WHERE project_id = ?")
      .run(startedAt, nowIso(), projectId);
  }

  completePoll(projectId: string, watermark: string): void {
    const now = nowIso();
    this.db
      .prepare(`
        UPDATE projects_state
        SET last_completed_watermark = ?, last_poll_finished_at = ?, updated_at = ?
        WHERE project_id = ?
      `)
      .run(watermark, now, now, projectId);
  }

  failPoll(projectId: string, error: string): void {
    this.db
      .prepare("UPDATE projects_state SET last_error = ?, updated_at = ? WHERE project_id = ?")
      .run(error, nowIso(), projectId);
  }

  getIssue(projectId: string, issueId: number): IssueState | null {
    const row = this.db
      .prepare("SELECT project_id, issue_id, last_seen_updated_on, last_seen_journal_id FROM issues_state WHERE project_id = ? AND issue_id = ?")
      .get(projectId, issueId) as IssueRow | undefined;
    if (!row) {
      return null;
    }
    return {
      projectId: row.project_id,
      issueId: row.issue_id,
      lastSeenUpdatedOn: row.last_seen_updated_on,
      lastSeenJournalId: row.last_seen_journal_id,
    };
  }

  upsertIssue(projectId: string, issueId: number, updatedOn: string, lastSeenJournalId: number | null): void {
    const now = nowIso();
    this.db
      .prepare(`
        INSERT INTO issues_state (
          project_id, issue_id, last_seen_updated_on, last_seen_journal_id,
          first_seen_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, issue_id) DO UPDATE SET
          last_seen_updated_on = excluded.last_seen_updated_on,
          last_seen_journal_id = COALESCE(excluded.last_seen_journal_id, issues_state.last_seen_journal_id),
          updated_at = excluded.updated_at
      `)
      .run(projectId, issueId, updatedOn, lastSeenJournalId, now, now);
  }
}

export class OutboxRepository {
  constructor(private readonly db: SqliteDatabase) {}

  enqueue(event: DetectedEvent, payload: DiscordWebhookPayload): boolean {
    const result = this.db
      .prepare(`
        INSERT OR IGNORE INTO notification_outbox (
          event_key, project_id, issue_id, journal_id, event_type, payload_json,
          status, attempt_count, next_attempt_at, detected_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
      `)
      .run(
        event.eventKey,
        event.projectId,
        event.issueId,
        event.journalId,
        event.eventType,
        JSON.stringify(payload),
        nowIso(),
        event.detectedAt,
      );
    return result.changes > 0;
  }

  listDue(limit: number, now: string): OutboxItem[] {
    const rows = this.db
      .prepare(`
        SELECT event_key, project_id, issue_id, journal_id, event_type, payload_json, attempt_count
        FROM notification_outbox
        WHERE status IN ('pending', 'failed')
          AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
        ORDER BY detected_at ASC
        LIMIT ?
      `)
      .all(now, limit) as OutboxRow[];

    return rows.map((row) => ({
      eventKey: row.event_key,
      projectId: row.project_id,
      issueId: row.issue_id,
      journalId: row.journal_id,
      eventType: row.event_type,
      payload: JSON.parse(row.payload_json) as DiscordWebhookPayload,
      attemptCount: row.attempt_count,
    }));
  }

  markSent(eventKey: string, sentAt: string): void {
    this.db
      .prepare(`
        UPDATE notification_outbox
        SET status = 'sent', sent_at = ?, next_attempt_at = NULL, last_error = NULL
        WHERE event_key = ?
      `)
      .run(sentAt, eventKey);
  }

  markFailed(eventKey: string, error: string, nextAttemptAt: string): void {
    this.db
      .prepare(`
        UPDATE notification_outbox
        SET status = 'failed',
            attempt_count = attempt_count + 1,
            last_error = ?,
            next_attempt_at = ?
        WHERE event_key = ?
      `)
      .run(error.slice(0, 1000), nextAttemptAt, eventKey);
  }

  hasEvent(eventKey: string): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM notification_outbox WHERE event_key = ?")
      .get(eventKey);
    return Boolean(row);
  }
}
