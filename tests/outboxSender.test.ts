import test from "node:test";
import assert from "node:assert/strict";
import { OutboxSender } from "../src/outboxSender.js";
import { DiscordClient } from "../src/discord/client.js";
import { Logger } from "../src/logger.js";
import { openDatabase } from "../src/state/database.js";
import { ConfigRepository } from "../src/state/configRepository.js";
import { OutboxRepository } from "../src/state/repositories.js";
import { formatDiscordPayload } from "../src/discord/formatter.js";
import type { DetectedEvent } from "../src/events.js";

test("sendDue resolves the webhook URL from the config repository, not a static snapshot", async () => {
  const db = openDatabase(":memory:");
  const configRepository = new ConfigRepository(db);
  const outbox = new OutboxRepository(db);
  const logger = new Logger("error");
  const sentTo: string[] = [];
  const discord = new DiscordClient();
  discord.send = async (webhookUrl: string) => {
    sentTo.push(webhookUrl);
  };

  const sender = new OutboxSender(configRepository, outbox, discord, logger);

  const event: DetectedEvent = {
    eventKey: "project:data-index:issue:1:created",
    projectId: "data-index",
    issueId: 1,
    journalId: null,
    eventType: "issue_created",
    detectedAt: "2026-07-13T00:00:00.000Z",
    issueUrl: "https://redmine.example.com/issues/1",
    issueSubject: "Example",
    authorName: "Tester",
  };
  outbox.enqueue(event, formatDiscordPayload(event));

  await sender.sendDue();
  assert.equal(sentTo.length, 0);

  configRepository.createProject({
    id: "data-index",
    webhookUrl: "https://discord.com/api/webhooks/1/abc",
    events: ["issue_created"],
  });

  await sender.sendDue();
  assert.deepEqual(sentTo, ["https://discord.com/api/webhooks/1/abc"]);

  db.close();
});
