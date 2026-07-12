export interface RedmineNamedRef {
  id: number;
  name: string;
}

export interface RedmineIssue {
  id: number;
  project?: RedmineNamedRef;
  tracker?: RedmineNamedRef;
  status?: RedmineNamedRef;
  priority?: RedmineNamedRef;
  author?: RedmineNamedRef;
  assigned_to?: RedmineNamedRef;
  subject: string;
  description?: string;
  created_on: string;
  updated_on: string;
  journals?: RedmineJournal[];
}

export interface RedmineJournalDetail {
  property: string;
  name: string;
  old_value?: string;
  new_value?: string;
}

export interface RedmineJournal {
  id: number;
  user?: RedmineNamedRef;
  notes?: string;
  created_on: string;
  details?: RedmineJournalDetail[];
}

export interface RedmineIssueListResponse {
  issues: RedmineIssue[];
  total_count: number;
  offset: number;
  limit: number;
}

export interface RedmineIssueResponse {
  issue: RedmineIssue;
}

export interface RedmineIssueStatusListResponse {
  issue_statuses: RedmineNamedRef[];
}

export interface RedmineIssuePriorityListResponse {
  issue_priorities: RedmineNamedRef[];
}
