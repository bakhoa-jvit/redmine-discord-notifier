import test from "node:test";
import assert from "node:assert/strict";
import { formatDiscordPayload } from "../src/discord/formatter.js";
import type { DetectedEvent } from "../src/events.js";

test("escapes Discord markdown in user-controlled content", () => {
  const event: DetectedEvent = {
    eventKey: "project:doctor-health:issue:123:journal:10:comment",
    projectId: "doctor-health",
    issueId: 123,
    journalId: 10,
    eventType: "comment_added",
    detectedAt: "2026-07-09T01:05:00.000Z",
    issueUrl: "https://redmine.example.com/issues/123",
    issueSubject: "Invoice [Click here](https://phish.example.com)",
    authorName: "*Attacker*",
    notes: "Payment failed — [verify now](https://phish.example.com)",
  };

  const payload = formatDiscordPayload(event);
  const embed = payload.embeds[0];

  assert.equal(embed?.fields?.[0]?.value, "#123 Invoice \\[Click here\\]\\(https://phish.example.com\\)");
  assert.equal(embed?.fields?.[1]?.value, "\\*Attacker\\*");
  assert.equal(embed?.description, "Payment failed — \\[verify now\\]\\(https://phish.example.com\\)");
});

test("leaves plain content unescaped", () => {
  const event: DetectedEvent = {
    eventKey: "project:doctor-health:issue:123:created",
    projectId: "doctor-health",
    issueId: 123,
    journalId: null,
    eventType: "issue_created",
    detectedAt: "2026-07-09T01:05:00.000Z",
    issueUrl: "https://redmine.example.com/issues/123",
    issueSubject: "Example issue",
    authorName: "Linh",
  };

  const payload = formatDiscordPayload(event);
  assert.equal(payload.embeds[0]?.fields?.[0]?.value, "#123 Example issue");
});

test("mentions the assignee in content when a Discord id is mapped", () => {
  const event: DetectedEvent = {
    eventKey: "project:doctor-health:issue:123:created",
    projectId: "doctor-health",
    issueId: 123,
    journalId: null,
    eventType: "issue_created",
    detectedAt: "2026-07-09T01:05:00.000Z",
    issueUrl: "https://redmine.example.com/issues/123",
    issueSubject: "Example issue",
    authorName: "Linh",
    assigneeDiscordId: "123456789012345678",
  };

  const payload = formatDiscordPayload(event);
  assert.equal(payload.content, "<@123456789012345678>");
  assert.deepEqual(payload.allowed_mentions, { parse: [], users: ["123456789012345678"] });
});

test("omits content and allowed_mentions when there is no assignee mapping", () => {
  const event: DetectedEvent = {
    eventKey: "project:doctor-health:issue:123:created",
    projectId: "doctor-health",
    issueId: 123,
    journalId: null,
    eventType: "issue_created",
    detectedAt: "2026-07-09T01:05:00.000Z",
    issueUrl: "https://redmine.example.com/issues/123",
    issueSubject: "Example issue",
    authorName: "Linh",
    assigneeDiscordId: null,
  };

  const payload = formatDiscordPayload(event);
  assert.equal(payload.content, undefined);
  assert.equal(payload.allowed_mentions, undefined);
});
