export type User = {
  name: string;
  email: string;
  avatar: string;
  isAdmin?: boolean;
};
export type Sender = { id: string; name: string; email: string };
export type EmailStatus =
  "scheduled" | "sending" | "sent" | "failed" | "uncertain";
export type Email = {
  id: string;
  recipient: string;
  subject: string;
  status: EmailStatus;
  scheduled_at: string;
  sent_at: string | null;
  preview_url?: string;
  error?: string;
  sender_id?: string;
  sender_name?: string;
  sender_email?: string;
  body?: string;
  delay_ms?: number;
  hourly_limit?: number;
};
export type View = "scheduled" | "sent" | "senders" | "integrations";
export type AppConfig = {
  minDelayMs: number;
  maxHourlyLimit: number;
  maxRecipients: number;
  googleConfigured: boolean;
  slackConfigured: boolean;
};
export type Stats = {
  scheduled: number;
  sent: number;
  failed: number;
  sentToday: number;
};
export type EmailPage = { rows: Email[]; total: number; page: number };
