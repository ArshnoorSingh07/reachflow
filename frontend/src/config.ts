import type { AppConfig } from "./types";
export const defaultConfig: AppConfig = {
  minDelayMs: 2000,
  maxHourlyLimit: 200,
  maxRecipients: 10000,
  googleConfigured: false,
  slackConfigured: false,
};
