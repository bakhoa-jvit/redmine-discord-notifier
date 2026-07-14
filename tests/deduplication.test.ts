import test from "node:test";
import assert from "node:assert/strict";
import { formatDiscordPayload } from "../src/discord/formatter.js";
import type { DetectedEvent } from "../src/events.js";
import { openDatabase } from "../src/state/database.js";
import { OutboxRepository } from "../src/state/repositories.js";

test("outbox deduplicates deterministic event keys", () => {
  const db = openDatabase(":memory:");
  const outbox = new OutboxRepository(db);
  const event = makeEvent();
  const payload = formatDiscordPayload(event);

  assert.equal(outbox.enqueue(event, payload), true);
  assert.equal(outbox.enqueue(event, payload), false);
  assert.equal(outbox.hasEvent(event.eventKey), true);
  assert.equal(outbox.listDue(10, "2099-07-09T01:30:00.000Z").length, 1);

  db.close();
});

test("sent outbox items are not due again", () => {
  const db = openDatabase(":memory:");
  const outbox = new OutboxRepository(db);
  const event = makeEvent();
  outbox.enqueue(event, formatDiscordPayload(event));

  outbox.markSent(event.eventKey, "2026-07-09T01:31:00.000Z");

  assert.equal(outbox.listDue(10, "2026-07-09T01:32:00.000Z").length, 0);
  db.close();
});

test("failed outbox items retry only after next attempt time", () => {
  const db = openDatabase(":memory:");
  const outbox = new OutboxRepository(db);
  const event = makeEvent();
  outbox.enqueue(event, formatDiscordPayload(event));

  outbox.markFailed(event.eventKey, "temporary", "2026-07-09T01:35:00.000Z");

  assert.equal(outbox.listDue(10, "2026-07-09T01:34:00.000Z").length, 0);
  assert.equal(outbox.listDue(10, "2026-07-09T01:35:00.000Z").length, 1);
  db.close();
});

test("deleteSentBefore removes only sent items older than the cutoff", () => {
  const db = openDatabase(":memory:");
  const outbox = new OutboxRepository(db);

  const oldSent = makeEvent("project:doctor-health:issue:1:created");
  outbox.enqueue(oldSent, formatDiscordPayload(oldSent));
  outbox.markSent(oldSent.eventKey, "2026-01-01T00:00:00.000Z");

  const recentSent = makeEvent("project:doctor-health:issue:2:created");
  outbox.enqueue(recentSent, formatDiscordPayload(recentSent));
  outbox.markSent(recentSent.eventKey, "2026-07-01T00:00:00.000Z");

  const stillPending = makeEvent("project:doctor-health:issue:3:created");
  outbox.enqueue(stillPending, formatDiscordPayload(stillPending));

  const deletedCount = outbox.deleteSentBefore("2026-06-01T00:00:00.000Z");

  assert.equal(deletedCount, 1);
  assert.equal(outbox.hasEvent(oldSent.eventKey), false);
  assert.equal(outbox.hasEvent(recentSent.eventKey), true);
  assert.equal(outbox.hasEvent(stillPending.eventKey), true);
  db.close();
});

function makeEvent(eventKey: string = "project:doctor-health:issue:123:journal:10:comment"): DetectedEvent {
  return {
    eventKey,
    projectId: "doctor-health",
    issueId: 123,
    journalId: 10,
    eventType: "comment_added",
    detectedAt: "2026-07-09T01:05:00.000Z",
    issueUrl: "https://redmine.example.com/issues/123",
    issueSubject: "Example issue",
    authorName: "Linh",
    notes: "Looks good",
  };
}
