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
  statusNames: Map<number, string>;
  priorityNames: Map<number, string>;
  assigneeDiscordIds: Map<number, string>;
}

const detailEventMap: Record<string, EventType> = {
  status_id: "status_changed",
  assigned_to_id: "assignee_changed",
  priority_id: "priority_changed",
};

export function detectEvents(input: DetectEventsInput): DetectedEvent[] {
  const assigneeDiscordId = resolveAssigneeDiscordId(input.issue, input.assigneeDiscordIds);
  if (!assigneeDiscordId) {
    return [];
  }

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
      assigneeDiscordId,
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
        assigneeDiscordId,
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
  const { oldValue, newValue } = resolveDetailValues(input, detail);
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
    assigneeDiscordId: resolveAssigneeDiscordId(input.issue, input.assigneeDiscordIds),
    field: detail.name,
    oldValue,
    newValue,
  };
}

function resolveAssigneeDiscordId(issue: RedmineIssue, assigneeDiscordIds: Map<number, string>): string | null {
  if (!issue.assigned_to) {
    return null;
  }
  return assigneeDiscordIds.get(issue.assigned_to.id) ?? null;
}

function resolveDetailValues(
  input: DetectEventsInput,
  detail: RedmineJournalDetail,
): { oldValue: string | null; newValue: string | null } {
  switch (detail.name) {
    case "status_id":
      return {
        oldValue: resolveNamedId(detail.old_value, input.statusNames, "Status"),
        newValue: resolveNamedId(detail.new_value, input.statusNames, "Status"),
      };
    case "priority_id":
      return {
        oldValue: resolveNamedId(detail.old_value, input.priorityNames, "Priority"),
        newValue: resolveNamedId(detail.new_value, input.priorityNames, "Priority"),
      };
    case "assigned_to_id":
      return {
        oldValue: resolveAssignee(detail.old_value, input.issue),
        newValue: resolveAssignee(detail.new_value, input.issue),
      };
    default:
      return { oldValue: detail.old_value ?? null, newValue: detail.new_value ?? null };
  }
}

function resolveNamedId(value: string | undefined, names: Map<number, string>, label: string): string | null {
  if (value === undefined || value === "") {
    return null;
  }
  const id = Number.parseInt(value, 10);
  if (Number.isNaN(id)) {
    return value;
  }
  return names.get(id) ?? `${label} #${id}`;
}

function resolveAssignee(value: string | undefined, issue: RedmineIssue): string | null {
  if (value === undefined || value === "") {
    return null;
  }
  const id = Number.parseInt(value, 10);
  if (Number.isNaN(id)) {
    return value;
  }
  if (issue.assigned_to?.id === id) {
    return issue.assigned_to.name;
  }
  return `User #${id}`;
}

function buildIssueCreatedKey(projectId: string, issueId: number): string {
  return `project:${projectId}:issue:${issueId}:created`;
}

function buildJournalKey(projectId: string, issueId: number, journalId: number, suffix: string): string {
  return `project:${projectId}:issue:${issueId}:journal:${journalId}:${suffix}`;
}
