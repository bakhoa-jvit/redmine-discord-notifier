import "dotenv/config";

import { loadConfig } from "./config.js";
import { DiscordClient } from "./discord/client.js";
import { Logger } from "./logger.js";
import { OutboxSender } from "./outboxSender.js";
import { Poller } from "./poller.js";
import { RedmineClient } from "./redmine/client.js";
import { openDatabase } from "./state/database.js";
import { OutboxRepository, StateRepository } from "./state/repositories.js";
import { sleep } from "./sleep.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const db = openDatabase(config.sqlitePath);
  const state = new StateRepository(db);
  const outbox = new OutboxRepository(db);
  const redmine = new RedmineClient(config.redmineBaseUrl, config.redmineApiKey);
  const discord = new DiscordClient();
  const poller = new Poller(config, redmine, state, outbox, logger);
  const sender = new OutboxSender(config.projects, outbox, discord, logger);
  const abort = new AbortController();

  const shutdown = (signal: string) => {
    logger.info("Shutdown requested", { signal });
    abort.abort();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  await poller.initializeProjects();
  logger.info("Redmine Discord notifier started", {
    projects: config.projects.map((project) => project.id),
    pollIntervalMs: config.pollIntervalMs,
  });

  while (!abort.signal.aborted) {
    await poller.pollOnce();
    await sender.sendDue();
    await sleep(config.pollIntervalMs, abort.signal);
  }

  await sender.sendDue();
  db.close();
  logger.info("Redmine Discord notifier stopped");
}

main().catch((error: unknown) => {
  const logger = new Logger("error");
  logger.error("Fatal error", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
