const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: { type: string; text: string }[];
}

export async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) return false;

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      console.error("Slack webhook error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to send Slack message:", err);
    return false;
  }
}

export function formatNotificationForSlack(
  title: string,
  message: string,
  link?: string | null
): SlackMessage {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const fullUrl = link
    ? link.startsWith("http") ? link : `${siteUrl}${link}`
    : null;

  const linkText = fullUrl ? ` | <${fullUrl}|View in SAMAP>` : "";

  return {
    text: `${title}: ${message}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${title}*\n${message}${linkText}`,
        },
      },
    ],
  };
}
