import type { RequestHandler } from "express";
import { env } from "../config/env.js";
export const getConfig: RequestHandler = (_req, res) => {
  res.json({
    minDelayMs: env.MIN_SEND_DELAY_MS,
    maxHourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
    maxRecipients: 10000,
    googleConfigured: !!(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    slackConfigured: !!(
      process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET
    ),
  });
};
