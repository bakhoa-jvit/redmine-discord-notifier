import "dotenv/config";

import { loadConfig } from "./config.js";
import { DiscordClient } from "./discord/client.js";
import { Logger } from "./logger.js";
import { OutboxSender } from "./outboxSender.js";
import { Poller } from "./poller.js";
import { RedmineClient } from "./redmine/client.js";
import { AdminUserRepository } from "./state/adminUserRepository.js";
import { ConfigRepository } from "./state/configRepository.js";
import { openDatabase } from "./state/database.js";
import { OutboxRepository, StateRepository } from "./state/repositories.js";
import { sleep } from "./sleep.js";
import { createAdminServer } from "./admin/server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const db = openDatabase(config.sqlitePath);
  const state = new StateRepository(db);
  const outbox = new OutboxRepository(db);
  const configRepository = new ConfigRepository(db);
  const adminUsers = new AdminUserRepository(db);

  adminUsers.seedFromEnvIfEmpty(config.adminUsername, config.adminPassword);

  const redmine = new RedmineClient(config.redmineBaseUrl, config.redmineApiKey);
  const discord = new DiscordClient();
  const poller = new Poller(config, redmine, configRepository, state, outbox, logger);
  const sender = new OutboxSender(configRepository, outbox, discord, logger);
  const abort = new AbortController();

  const shutdown = (signal: string) => {
    logger.info("Shutdown requested", { signal });
    abort.abort();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  const adminApp = createAdminServer({
    configRepository,
    adminUsers,
    sessionSecret: config.adminSessionSecret,
  });
  const adminServer = adminApp.listen(config.adminPort, () => {
    logger.info("Admin server listening", { port: config.adminPort });
  });

  try {
    await poller.initializeProjects();
    logger.info("Redmine Discord notifier started", {
      projects: configRepository.listProjects().map((project) => project.id),
      pollIntervalMs: config.pollIntervalMs,
    });

    while (!abort.signal.aborted) {
      await poller.pollOnce();
      await sender.sendDue();
      await sleep(config.pollIntervalMs, abort.signal);
    }

    await sender.sendDue();
  } finally {
    await new Promise<void>((resolve) => adminServer.close(() => resolve()));
    db.close();
  }
  logger.info("Redmine Discord notifier stopped");
}

main().catch((error: unknown) => {
  const logger = new Logger("error");
  logger.error("Fatal error", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
