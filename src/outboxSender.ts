import type { ProjectConfig } from "./config.js";
import type { DiscordClient } from "./discord/client.js";
import type { Logger } from "./logger.js";
import type { OutboxRepository } from "./state/repositories.js";
import { addMs, nowIso } from "./time.js";

export class OutboxSender {
  constructor(
    private readonly projects: ProjectConfig[],
    private readonly outbox: OutboxRepository,
    private readonly discord: DiscordClient,
    private readonly logger: Logger,
  ) {}

  async sendDue(): Promise<void> {
    const projectById = new Map(this.projects.map((project) => [project.id, project]));
    const due = this.outbox.listDue(25, nowIso());

    for (const item of due) {
      const project = projectById.get(item.projectId);
      if (!project) {
        this.logger.warn("Skipping outbox item for unconfigured project", {
          projectId: item.projectId,
          eventKey: item.eventKey,
        });
        continue;
      }

      try {
        await this.discord.send(project.webhookUrl, item.payload);
        this.outbox.markSent(item.eventKey, nowIso());
        this.logger.info("Sent Discord notification", {
          projectId: item.projectId,
          issueId: item.issueId,
          eventKey: item.eventKey,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const delayMs = retryDelayMs(item.attemptCount + 1);
        const nextAttemptAt = addMs(nowIso(), delayMs);
        this.outbox.markFailed(item.eventKey, message, nextAttemptAt);
        this.logger.warn("Discord notification failed; scheduled retry", {
          projectId: item.projectId,
          eventKey: item.eventKey,
          attempt: item.attemptCount + 1,
          nextAttemptAt,
          error: message,
        });
      }
    }
  }
}

function retryDelayMs(attempt: number): number {
  const seconds = Math.min(3600, Math.max(30, 30 * 2 ** Math.min(attempt - 1, 7)));
  return seconds * 1000;
}
