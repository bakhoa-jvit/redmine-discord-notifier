import test from "node:test";
import assert from "node:assert/strict";
import { DataCleanup } from "../src/dataCleanup.js";
import { Logger } from "../src/logger.js";
import type { OutboxRepository } from "../src/state/repositories.js";

function createFakeOutbox(deleteSentBefore: (cutoff: string) => number): OutboxRepository {
  return { deleteSentBefore } as unknown as OutboxRepository;
}

test("runs on the very first call and deletes sent items older than now minus the retention window", () => {
  const cutoffs: string[] = [];
  const outbox = createFakeOutbox((cutoff) => {
    cutoffs.push(cutoff);
    return 0;
  });
  const cleanup = new DataCleanup(outbox, 1000, new Logger("error"));

  cleanup.runIfDue("2026-01-01T00:00:00.000Z");

  assert.deepEqual(cutoffs, ["2025-12-31T23:59:59.000Z"]);
});

test("skips a second call before the retention interval has elapsed since the last run", () => {
  let runs = 0;
  const outbox = createFakeOutbox(() => {
    runs += 1;
    return 0;
  });
  const cleanup = new DataCleanup(outbox, 1000, new Logger("error"));

  cleanup.runIfDue("2026-01-01T00:00:00.000Z");
  cleanup.runIfDue("2026-01-01T00:00:00.500Z");

  assert.equal(runs, 1);
});

test("runs again once the retention interval has elapsed since the last run", () => {
  let runs = 0;
  const outbox = createFakeOutbox(() => {
    runs += 1;
    return 0;
  });
  const cleanup = new DataCleanup(outbox, 1000, new Logger("error"));

  cleanup.runIfDue("2026-01-01T00:00:00.000Z");
  cleanup.runIfDue("2026-01-01T00:00:01.500Z");

  assert.equal(runs, 2);
});
