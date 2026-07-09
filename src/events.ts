import type { EventType } from "./config.js";

export interface DetectedEvent {
  eventKey: string;
  projectId: string;
  issueId: number;
  journalId: number | null;
  eventType: EventType;
  detectedAt: string;
  issueUrl: string;
  issueSubject: string;
  authorName: string | null;
  notes?: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
}
