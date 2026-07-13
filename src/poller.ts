import type { AppConfig, ProjectConfig } from "./config.js";
import { detectEvents, maxJournalId } from "./detection/eventDetector.js";
import { formatDiscordPayload } from "./discord/formatter.js";
import type { Logger } from "./logger.js";
import type { RedmineClient } from "./redmine/client.js";
import { ReferenceDataCache } from "./redmine/referenceData.js";
import type { ConfigRepository } from "./state/configRepository.js";
import type { OutboxRepository, StateRepository } from "./state/repositories.js";
import { addMs, isAfter, maxIso, nowIso } from "./time.js";

export function initializeNewProjects(
  projects: ProjectConfig[],
  state: StateRepository,
  logger: Logger,
): void {
  for (const project of projects) {
    if (state.getProject(project.id)) {
      continue;
    }
    const baselineAt = nowIso();
    state.initializeProject(project.id, baselineAt);
    logger.info("Initialized project baseline", { projectId: project.id, baselineAt });
  }
}

export class Poller {
  private readonly referenceData: ReferenceDataCache;
  private readonly serviceStartedAt = nowIso();

  constructor(
    private readonly config: AppConfig,
    private readonly redmine: RedmineClient,
    private readonly configRepository: ConfigRepository,
    private readonly state: StateRepository,
    private readonly outbox: OutboxRepository,
    private readonly logger: Logger,
  ) {
    this.referenceData = new ReferenceDataCache(redmine);
  }

  async initializeProjects(): Promise<void> {
    await this.referenceData.refresh();

    for (const project of this.configRepository.listProjects()) {
      const current = this.state.getProject(project.id);
      if (current?.initialized) {
        if (this.config.skipMissedOnStart) {
          this.state.completePoll(project.id, this.serviceStartedAt);
          this.logger.info("Skipped missed activity before service start", {
            projectId: project.id,
            skippedBefore: this.serviceStartedAt,
          });
        }
        continue;
      }
      const baselineAt = nowIso();
      this.state.initializeProject(project.id, baselineAt);
      this.logger.info("Initialized project baseline", { projectId: project.id, baselineAt });
    }
  }

  async pollOnce(): Promise<void> {
    const projects = this.configRepository.listProjects();
    initializeNewProjects(projects, this.state, this.logger);
    const assigneeDiscordIds = this.configRepository.getAssigneeDiscordIds();

    for (const project of projects) {
      await this.pollProject(project, assigneeDiscordIds);
    }
  }

  private async pollProject(project: ProjectConfig, assigneeDiscordIds: Map<number, string>): Promise<void> {
    const pollStartedAt = nowIso();

    try {
      const projectState = this.state.getProject(project.id);
      if (!projectState?.initialized || !projectState.baselineAt || !projectState.lastCompletedWatermark) {
        throw new Error(`Project is not initialized: ${project.id}`);
      }

      const updatedFrom = addMs(projectState.lastCompletedWatermark, -this.config.pollOverlapMs);
      const updatedTo = pollStartedAt;
      let offset = 0;
      let maxProcessedUpdatedOn = projectState.lastCompletedWatermark;
      let detailRequests = 0;

      this.state.markPollStarted(project.id, pollStartedAt);

      while (true) {
        const page = await this.redmine.listChangedIssues({
          projectId: project.id,
          updatedFrom,
          updatedTo,
          limit: this.config.redminePageLimit,
          offset,
        });

        for (const listedIssue of page.issues) {
          const issueState = this.state.getIssue(project.id, listedIssue.id);
          const effectiveBaselineAt = this.effectiveBaselineAt(projectState.baselineAt);

          if (this.config.skipMissedOnStart && !isAfter(listedIssue.updated_on, this.serviceStartedAt)) {
            maxProcessedUpdatedOn = maxIso(maxProcessedUpdatedOn, listedIssue.updated_on);
            continue;
          }

          if (issueState && !isAfter(listedIssue.updated_on, issueState.lastSeenUpdatedOn)) {
            maxProcessedUpdatedOn = maxIso(maxProcessedUpdatedOn, listedIssue.updated_on);
            continue;
          }

          if (detailRequests >= this.config.maxIssueDetailRequestsPerCycle) {
            this.logger.warn("Reached max issue detail requests for cycle", {
              projectId: project.id,
              detailRequests,
            });
            this.state.completePoll(project.id, maxProcessedUpdatedOn);
            return;
          }

          detailRequests += 1;
          const issue = await this.redmine.getIssueWithJournals(listedIssue.id);
          const events = detectEvents({
            project,
            issue,
            issueUrl: this.redmine.issueUrl(issue.id),
            baselineAt: effectiveBaselineAt,
            knownIssue: issueState !== null,
            lastSeenJournalId: issueState?.lastSeenJournalId ?? null,
            statusNames: this.referenceData.getStatusNames(),
            priorityNames: this.referenceData.getPriorityNames(),
            assigneeDiscordIds,
          });

          for (const event of events) {
            const payload = formatDiscordPayload(event);
            const enqueued = this.outbox.enqueue(event, payload);
            if (enqueued) {
              this.logger.info("Queued notification", {
                projectId: project.id,
                issueId: event.issueId,
                eventType: event.eventType,
                eventKey: event.eventKey,
              });
            }
          }

          this.state.upsertIssue(project.id, issue.id, issue.updated_on, maxJournalId(issue));
          maxProcessedUpdatedOn = maxIso(maxProcessedUpdatedOn, issue.updated_on);
        }

        offset += page.limit;
        if (offset >= page.total_count || page.issues.length === 0) {
          break;
        }
      }

      this.state.completePoll(project.id, maxProcessedUpdatedOn);
      this.logger.debug("Completed poll", { projectId: project.id, watermark: maxProcessedUpdatedOn });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.failPoll(project.id, message);
      this.logger.error("Poll failed", { projectId: project.id, error: message });
    }
  }

  private effectiveBaselineAt(projectBaselineAt: string): string {
    if (!this.config.skipMissedOnStart) {
      return projectBaselineAt;
    }
    return isAfter(this.serviceStartedAt, projectBaselineAt) ? this.serviceStartedAt : projectBaselineAt;
  }
}
