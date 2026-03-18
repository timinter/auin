import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { notificationEmail } from "@/lib/email/templates";
import { sendSlackMessage, formatNotificationForSlack } from "@/lib/slack/webhook";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "action";
  link?: string;
  /** Send to Slack admin channel. Only set true for admin-targeted notifications. */
  slackNotify?: boolean;
}

/**
 * Create an in-app notification for a user,
 * and also send email + Slack notifications (fire-and-forget).
 * Uses service role client — call from server-side only.
 */
export async function createNotification(
  client: SupabaseClient,
  params: CreateNotificationParams
) {
  // 1. In-app notification (primary)
  const { error } = await client.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    type: params.type || "info",
    link: params.link || null,
  });

  if (error) {
    console.error("Failed to create notification:", error);
  }

  // 2. Email + Slack (fire-and-forget, never block the response)
  sendExternalNotifications(client, params).catch((err) =>
    console.error("External notification error:", err)
  );
}

/**
 * Create notifications for multiple users at once.
 * Email + Slack sent for each user.
 */
export async function createNotifications(
  client: SupabaseClient,
  userIds: string[],
  params: Omit<CreateNotificationParams, "userId">
) {
  if (userIds.length === 0) return;

  const rows = userIds.map((userId) => ({
    user_id: userId,
    title: params.title,
    message: params.message,
    type: params.type || "info",
    link: params.link || null,
  }));

  const { error } = await client.from("notifications").insert(rows);

  if (error) {
    console.error("Failed to create notifications:", error);
  }

  // Email each user (fire-and-forget) + single Slack message if flagged
  const externalPromises: Promise<unknown>[] = userIds.map((userId) =>
    sendExternalNotifications(client, { ...params, userId, slackNotify: false })
  );
  if (params.slackNotify) {
    const slackMsg = formatNotificationForSlack(
      params.title,
      params.message,
      params.link
    );
    externalPromises.push(sendSlackMessage(slackMsg));
  }
  Promise.all(externalPromises).catch((err) =>
    console.error("External notification error:", err)
  );
}

/**
 * Send email and Slack for a notification.
 * Looks up the user's email from their profile.
 * Gracefully no-ops if services are not configured.
 */
async function sendExternalNotifications(
  client: SupabaseClient,
  params: CreateNotificationParams
) {
  const promises: Promise<unknown>[] = [];

  // Email: look up user email
  const { data: profile } = await client
    .from("profiles")
    .select("email, first_name")
    .eq("id", params.userId)
    .single();

  if (profile?.email) {
    const { subject, html } = notificationEmail(
      params.title,
      params.message,
      params.link
    );
    promises.push(sendEmail({ to: profile.email, subject, html }));
  }

  // Slack (only for admin-targeted notifications)
  if (params.slackNotify) {
    const slackMsg = formatNotificationForSlack(
      params.title,
      params.message,
      params.link
    );
    promises.push(sendSlackMessage(slackMsg));
  }

  await Promise.allSettled(promises);
}
