import axios from "axios";
import { logger } from "./logger.js";

const APP_NOTIF_USER_URL =
  (process.env.CCD_APP_NOTIF_USER_URL || "https://iitg.ac.in/ccd-app/notifications/send-user").trim();
const APP_NOTIF_TOKEN = (process.env.CCD_APP_NOTIF_TOKEN || "").trim();

let urlValid = false;
try {
  const p = new URL(APP_NOTIF_USER_URL);
  urlValid = p.protocol === "http:" || p.protocol === "https:";
} catch (_) {}

/**
 * Send a push notification to a specific user by email via the CCD app.
 * Mirrors the placement portal's sendUserNotification — same endpoint, same payload.
 * Fire-and-forget: callers must NOT await this.
 */
export const sendUserNotification = async ({
  email,
  title,
  body,
  priority = "high",
  time,
  type = "placement",
}) => {
  if (!APP_NOTIF_TOKEN) {
    logger.info("[CCDApp] user notification skipped — CCD_APP_NOTIF_TOKEN not set");
    return;
  }
  if (!urlValid) {
    logger.warn(`[CCDApp] user notification skipped — CCD_APP_NOTIF_USER_URL invalid ("${APP_NOTIF_USER_URL}")`);
    return;
  }
  if (!email || !title || !body) return;

  const notifTime =
    time ||
    new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

  try {
    await axios.post(
      APP_NOTIF_USER_URL,
      { email, title, body, priority, time: notifTime, type },
      {
        headers: { "Content-Type": "application/json", authorization: APP_NOTIF_TOKEN },
        timeout: 8000,
      }
    );
  } catch (e) {
    const status = e?.response?.status;
    const respBody = JSON.stringify(e?.response?.data || {}).slice(0, 500);
    logger.error(`[CCDApp] user notification failed → ${email} status=${status} msg="${e?.message || ""}" body=${respBody}`);
  }
};
