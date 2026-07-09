import type { EventType, ProjectConfig } from "../config.js";
import type { DetectedEvent } from "../events.js";
import type { RedmineIssue, RedmineJournal, RedmineJournalDetail } from "../redmine/types.js";
import { isAfter } from "../time.js";

export interface DetectEventsInput {
  project: Pick<ProjectConfig, "id" | "events">;
  issue: RedmineIssue;
  issueUrl: string;
  baselineAt: string;
  knownIssue: boolean;
  lastSeenJournalId: number | null;
}

const detailEventMap: Record<string, EventType> = {
  status_id: "status_changed",
  assigned_to_id: "assignee_changed",
  priority_id: "priority_changed",
};

export function detectEvents(input: DetectEventsInput): DetectedEvent[] {
  const enabled = new Set(input.project.events);
  const events: DetectedEvent[] = [];

  if (
    !input.knownIssue &&
    enabled.has("issue_created") &&
    isAfter(input.issue.created_on, input.baselineAt)
  ) {
    events.push({
      eventKey: buildIssueCreatedKey(input.project.id, input.issue.id),
      projectId: input.project.id,
      issueId: input.issue.id,
      journalId: null,
      eventType: "issue_created",
      detectedAt: input.issue.created_on,
      issueUrl: input.issueUrl,
      issueSubject: input.issue.subject,
      authorName: input.issue.author?.name ?? null,
    });
  }

  for (const journal of input.issue.journals ?? []) {
    if (!isProcessableJournal(journal, input.baselineAt, input.lastSeenJournalId)) {
      continue;
    }

    if (enabled.has("comment_added") && journal.notes && journal.notes.trim() !== "") {
      events.push({
        eventKey: buildJournalKey(input.project.id, input.issue.id, journal.id, "comment"),
        projectId: input.project.id,
        issueId: input.issue.id,
        journalId: journal.id,
        eventType: "comment_added",
        detectedAt: journal.created_on,
        issueUrl: input.issueUrl,
        issueSubject: input.issue.subject,
        authorName: journal.user?.name ?? null,
        notes: journal.notes.trim(),
      });
    }

    for (const detail of journal.details ?? []) {
      const eventType = detailEventMap[detail.name];
      if (!eventType || !enabled.has(eventType)) {
        continue;
      }
      events.push(buildDetailEvent(input, journal, detail, eventType));
    }
  }

  return events;
}

export function maxJournalId(issue: RedmineIssue): number | null {
  let maxId: number | null = null;
  for (const journal of issue.journals ?? []) {
    maxId = maxId === null ? journal.id : Math.max(maxId, journal.id);
  }
  return maxId;
}

function isProcessableJournal(
  journal: RedmineJournal,
  baselineAt: string,
  lastSeenJournalId: number | null,
): boolean {
  if (!isAfter(journal.created_on, baselineAt)) {
    return false;
  }
  if (lastSeenJournalId !== null && journal.id <= lastSeenJournalId) {
    return false;
  }
  return true;
}

function buildDetailEvent(
  input: DetectEventsInput,
  journal: RedmineJournal,
  detail: RedmineJournalDetail,
  eventType: EventType,
): DetectedEvent {
  return {
    eventKey: buildJournalKey(input.project.id, input.issue.id, journal.id, `field:${detail.name}`),
    projectId: input.project.id,
    issueId: input.issue.id,
    journalId: journal.id,
    eventType,
    detectedAt: journal.created_on,
    issueUrl: input.issueUrl,
    issueSubject: input.issue.subject,
    authorName: journal.user?.name ?? null,
    field: detail.name,
    oldValue: detail.old_value ?? null,
    newValue: detail.new_value ?? null,
  };
}

function buildIssueCreatedKey(projectId: string, issueId: number): string {
  return `project:${projectId}:issue:${issueId}:created`;
}

function buildJournalKey(projectId: string, issueId: number, journalId: number, suffix: string): string {
  return `project:${projectId}:issue:${issueId}:journal:${journalId}:${suffix}`;
}
