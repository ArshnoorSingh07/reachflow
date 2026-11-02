export type User = {
  name: string;
  email: string;
  avatar: string;
  isAdmin?: boolean;
  provider?: "google" | "password";
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
  body_html?: string;
  starred?: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;
  attachments?: {
    id: string;
    name: string;
    content_type: string;
    size: number;
  }[];
  delay_ms?: number;
  hourly_limit?: number;
};
export type View =
  | "scheduled"
  | "sent"
  | "senders"
  | "integrations"
  | "starred"
  | "archived"
  | "trash";
export type AppConfig = {
  minDelayMs: number;
  maxHourlyLimit: number;
  maxRecipients: number;
  googleConfigured: boolean;
  slackConfigured: boolean;
  slackOAuthReady?: boolean;
};
export type Stats = {
  scheduled: number;
  sent: number;
  failed: number;
  sentToday: number;
};
export type EmailPage = { rows: Email[]; total: number; page: number };

export type AttachmentInput = { name: string; type: string; data: string };
