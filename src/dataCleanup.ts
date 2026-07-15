import type { Logger } from "./logger.js";
import type { OutboxRepository } from "./state/repositories.js";
import { addMs, isAfter } from "./time.js";

export class DataCleanup {
  private lastRunAt: string | null = null;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly retentionMs: number,
    private readonly logger: Logger,
  ) {}

  runIfDue(now: string): void {
    if (this.lastRunAt !== null && !isAfter(now, addMs(this.lastRunAt, this.retentionMs))) {
      return;
    }

    const cutoff = addMs(now, -this.retentionMs);
    const deletedCount = this.outbox.deleteSentBefore(cutoff);
    this.lastRunAt = now;

    if (deletedCount > 0) {
      this.logger.info("Cleaned up old sent notifications", { deletedCount, cutoff });
    }
  }
}
