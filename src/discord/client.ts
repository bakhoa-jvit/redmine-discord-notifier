import type { DiscordWebhookPayload } from "./formatter.js";

export class DiscordClient {
  async send(webhookUrl: string, payload: DiscordWebhookPayload): Promise<void> {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText} ${body}`);
    }
  }
}
