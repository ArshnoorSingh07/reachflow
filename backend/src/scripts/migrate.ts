import { db } from "../config/database.js";
await db.query(`CREATE TABLE IF NOT EXISTS users(id text PRIMARY KEY,email text NOT NULL,name text NOT NULL,avatar text,slack_webhook text);
CREATE TABLE IF NOT EXISTS senders(id uuid PRIMARY KEY,user_id text REFERENCES users(id),name text NOT NULL,email text NOT NULL,smtp_user text NOT NULL,smtp_password text NOT NULL,smtp_host text NOT NULL,smtp_port integer NOT NULL);
CREATE TABLE IF NOT EXISTS batches(id uuid PRIMARY KEY,user_id text REFERENCES users(id),idempotency_key text NOT NULL,payload_hash text NOT NULL,UNIQUE(user_id,idempotency_key));
CREATE TABLE IF NOT EXISTS emails(id uuid PRIMARY KEY,user_id text REFERENCES users(id),batch_id uuid REFERENCES batches(id),sender_id uuid REFERENCES senders(id),recipient text NOT NULL,subject text NOT NULL,body text NOT NULL,scheduled_at timestamptz NOT NULL,sent_at timestamptz,status text NOT NULL DEFAULT 'scheduled',delay_ms integer NOT NULL,hourly_limit integer NOT NULL,error text,preview_url text,version integer NOT NULL DEFAULT 1,indexed_version integer NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS emails_user_status ON emails(user_id,status,scheduled_at);
CREATE TABLE IF NOT EXISTS notifications(id text PRIMARY KEY,user_id text REFERENCES users(id),sender_id uuid REFERENCES senders(id),created_at timestamptz DEFAULT now(),sent_at timestamptz);`);
await db.query(
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;`,
);
await db.query(`
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'google';
CREATE TABLE IF NOT EXISTS password_credentials(email text PRIMARY KEY,user_id text UNIQUE NOT NULL REFERENCES users(id),password_hash text NOT NULL);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS body_html text;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE TABLE IF NOT EXISTS attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),batch_id uuid NOT NULL REFERENCES batches(id),name text NOT NULL,content_type text NOT NULL,content bytea NOT NULL);
CREATE INDEX IF NOT EXISTS attachments_batch ON attachments(batch_id);
`);
console.log("Database ready");
await db.end();
process.exit(0);
