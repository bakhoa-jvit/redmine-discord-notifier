import type { RedmineClient } from "./client.js";
import type { RedmineNamedRef } from "./types.js";

export class ReferenceDataCache {
  private statusNames = new Map<number, string>();
  private priorityNames = new Map<number, string>();

  constructor(private readonly redmine: RedmineClient) {}

  async refresh(): Promise<void> {
    const [statuses, priorities] = await Promise.all([
      this.redmine.listIssueStatuses(),
      this.redmine.listIssuePriorities(),
    ]);
    this.statusNames = toNameMap(statuses);
    this.priorityNames = toNameMap(priorities);
  }

  getStatusNames(): Map<number, string> {
    return this.statusNames;
  }

  getPriorityNames(): Map<number, string> {
    return this.priorityNames;
  }
}

function toNameMap(refs: RedmineNamedRef[]): Map<number, string> {
  return new Map(refs.map((ref) => [ref.id, ref.name]));
}
