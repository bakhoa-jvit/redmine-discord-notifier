import test from "node:test";
import assert from "node:assert/strict";
import type { EventType } from "../src/config.js";
import { detectEvents } from "../src/detection/eventDetector.js";
import type { RedmineIssue } from "../src/redmine/types.js";

const project = {
  id: "doctor-health",
  events: [
    "issue_created",
    "comment_added",
    "status_changed",
    "assignee_changed",
    "priority_changed",
  ] satisfies EventType[],
};

test("detects issue creation after baseline", () => {
  const issue = makeIssue({ created_on: "2026-07-09T01:01:00.000Z", journals: [] });
  const events = detectEvents({
    project,
    issue,
    issueUrl: "https://redmine.example.com/issues/123",
    baselineAt: "2026-07-09T01:00:00.000Z",
    knownIssue: false,
    lastSeenJournalId: null,
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "issue_created");
  assert.equal(events[0]?.eventKey, "project:doctor-health:issue:123:created");
});

test("detects comments and tracked field changes from new journals", () => {
  const issue = makeIssue({
    journals: [
      {
        id: 10,
        notes: "Looks good",
        created_on: "2026-07-09T01:05:00.000Z",
        user: { id: 7, name: "Linh" },
        details: [
          { property: "attr", name: "status_id", old_value: "1", new_value: "2" },
          { property: "attr", name: "priority_id", old_value: "3", new_value: "4" },
          { property: "attr", name: "subject", old_value: "A", new_value: "B" },
        ],
      },
    ],
  });

  const events = detectEvents({
    project,
    issue,
    issueUrl: "https://redmine.example.com/issues/123",
    baselineAt: "2026-07-09T01:00:00.000Z",
    knownIssue: true,
    lastSeenJournalId: 9,
  });

  assert.deepEqual(
    events.map((event) => event.eventType),
    ["comment_added", "status_changed", "priority_changed"],
  );
});

test("skips old journals and blank comments", () => {
  const issue = makeIssue({
    journals: [
      {
        id: 8,
        notes: "old",
        created_on: "2026-07-09T00:59:00.000Z",
        details: [{ property: "attr", name: "status_id", old_value: "1", new_value: "2" }],
      },
      {
        id: 9,
        notes: "   ",
        created_on: "2026-07-09T01:10:00.000Z",
        details: [],
      },
    ],
  });

  const events = detectEvents({
    project,
    issue,
    issueUrl: "https://redmine.example.com/issues/123",
    baselineAt: "2026-07-09T01:00:00.000Z",
    knownIssue: true,
    lastSeenJournalId: 8,
  });

  assert.equal(events.length, 0);
});

test("respects configured event types", () => {
  const issue = makeIssue({
    journals: [
      {
        id: 10,
        notes: "Only comments enabled",
        created_on: "2026-07-09T01:05:00.000Z",
        details: [{ property: "attr", name: "status_id", old_value: "1", new_value: "2" }],
      },
    ],
  });

  const events = detectEvents({
    project: { id: "doctor-health", events: ["comment_added"] },
    issue,
    issueUrl: "https://redmine.example.com/issues/123",
    baselineAt: "2026-07-09T01:00:00.000Z",
    knownIssue: true,
    lastSeenJournalId: null,
  });

  assert.deepEqual(events.map((event) => event.eventType), ["comment_added"]);
});

function makeIssue(overrides: Partial<RedmineIssue> = {}): RedmineIssue {
  return {
    id: 123,
    subject: "Example issue",
    created_on: "2026-07-09T01:01:00.000Z",
    updated_on: "2026-07-09T01:10:00.000Z",
    author: { id: 1, name: "Mai" },
    journals: [],
    ...overrides,
  };
}
