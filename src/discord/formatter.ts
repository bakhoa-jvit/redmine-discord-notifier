import type { DetectedEvent } from "../events.js";

interface DiscordEmbed {
  title: string;
  url: string;
  description?: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp: string;
}

export interface DiscordWebhookPayload {
  username: string;
  content?: string;
  allowed_mentions?: { parse: []; users: string[] };
  embeds: DiscordEmbed[];
}

const colors: Record<DetectedEvent["eventType"], number> = {
  issue_created: 0x2ecc71,
  comment_added: 0x3498db,
  status_changed: 0xf1c40f,
  assignee_changed: 0x9b59b6,
  priority_changed: 0xe67e22,
};

const titles: Record<DetectedEvent["eventType"], string> = {
  issue_created: "New Redmine issue",
  comment_added: "New Redmine comment",
  status_changed: "Redmine status changed",
  assignee_changed: "Redmine assignee changed",
  priority_changed: "Redmine priority changed",
};

export function formatDiscordPayload(event: DetectedEvent): DiscordWebhookPayload {
  const issueSubject = escapeDiscordMarkdown(event.issueSubject);
  const authorName = event.authorName ? escapeDiscordMarkdown(event.authorName) : null;
  const notes = event.notes ? escapeDiscordMarkdown(event.notes) : undefined;

  const fields = [{ name: "Issue", value: `#${event.issueId} ${issueSubject}`, inline: false }];

  if (authorName) {
    fields.push({ name: "Author", value: authorName, inline: true });
  }

  if (event.oldValue !== undefined || event.newValue !== undefined) {
    const oldValue = event.oldValue ? escapeDiscordMarkdown(event.oldValue) : event.oldValue;
    const newValue = event.newValue ? escapeDiscordMarkdown(event.newValue) : event.newValue;
    fields.push({
      name: "Change",
      value: `${oldValue ?? "(empty)"} -> ${newValue ?? "(empty)"}`,
      inline: false,
    });
  }

  return {
    username: "Redmine",
    ...(event.assigneeDiscordId
      ? {
          content: `<@${event.assigneeDiscordId}>`,
          allowed_mentions: { parse: [] as [], users: [event.assigneeDiscordId] },
        }
      : {}),
    embeds: [
      {
        title: titles[event.eventType],
        url: event.issueUrl,
        description: notes ? truncate(notes, 3500) : undefined,
        color: colors[event.eventType],
        fields,
        footer: { text: event.eventKey },
        timestamp: event.detectedAt,
      },
    ],
  };
}

const markdownSpecialChars = /[\\`*_~|[\]()<>]/g;

function escapeDiscordMarkdown(value: string): string {
  return value.replace(markdownSpecialChars, (char) => `\\${char}`);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}
