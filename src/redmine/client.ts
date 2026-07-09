import type { RedmineIssue, RedmineIssueListResponse, RedmineIssueResponse } from "./types.js";

export interface ListChangedIssuesInput {
  projectId: string;
  updatedFrom: string;
  updatedTo: string;
  limit: number;
  offset: number;
}

export class RedmineClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async listChangedIssues(input: ListChangedIssuesInput): Promise<RedmineIssueListResponse> {
    const params = new URLSearchParams({
      project_id: input.projectId,
      status_id: "*",
      sort: "updated_on:asc,id:asc",
      limit: String(input.limit),
      offset: String(input.offset),
      updated_on: `>=${toRedmineDate(input.updatedFrom)}`,
    });
    const response = await this.get<RedmineIssueListResponse>(`/issues.json?${params.toString()}`);
    response.issues = response.issues.filter(
      (issue) => new Date(issue.updated_on).getTime() <= new Date(input.updatedTo).getTime(),
    );
    return response;
  }

  async getIssueWithJournals(issueId: number): Promise<RedmineIssue> {
    const params = new URLSearchParams({ include: "journals" });
    const response = await this.get<RedmineIssueResponse>(`/issues/${issueId}.json?${params.toString()}`);
    return response.issue;
  }

  issueUrl(issueId: number): string {
    return `${this.baseUrl}/issues/${issueId}`;
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "X-Redmine-API-Key": this.apiKey,
          Accept: "application/json",
        },
      });
    } catch (error) {
      throw new Error(`Redmine request failed before response: ${url} (${describeFetchError(error)})`);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Redmine request failed: ${response.status} ${response.statusText} ${url} ${body}`);
    }
    return (await response.json()) as T;
  }
}

function toRedmineDate(iso: string): string {
  return iso.slice(0, 10);
}

function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const cause = error.cause;
  if (cause instanceof Error) {
    return `${error.message}; cause=${cause.message}`;
  }
  if (cause && typeof cause === "object" && "message" in cause) {
    return `${error.message}; cause=${String(cause.message)}`;
  }
  return error.message;
}
