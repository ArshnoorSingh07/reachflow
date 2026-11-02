/** One authorized Slack alert via an actual rate-limit event; captured SMTP only. */
import pg from "pg";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
if (process.env.ALLOW_SLACK_TEST_ALERT !== "1")
  throw Error("Explicit ALLOW_SLACK_TEST_ALERT=1 is required.");
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith("_test"))
  throw Error("An isolated _test database is required");
const primary = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const connected = await primary.query<{ slack_webhook: string }>(
  "SELECT slack_webhook FROM users WHERE slack_webhook IS NOT NULL",
);
await primary.end();
if (connected.rows.length !== 1)
  throw Error(
    "Expected exactly one connected account; select the target explicitly before sending.",
  );
const ciphertext = connected.rows[0].slack_webhook;
const runId = randomUUID(),
  userId = `slack-verify-${runId}`,
  prefix = `slackverify-${runId}`,
  index = `test-slackverify-${runId}`;
Object.assign(process.env, {
  DATABASE_URL: testUrl,
  QUEUE_PREFIX: prefix,
  ELASTIC_INDEX: index,
  NODE_ENV: "test",
});
const { db } = await import("../backend/src/config/database.js"),
  { redis } = await import("../backend/src/config/redis.js"),
  { emails, maintenance } = await import("../backend/src/config/queues.js"),
  { SenderService } = await import("../backend/src/services/sender.service.js"),
  { BatchModel } = await import("../backend/src/models/batch.model.js"),
  { enqueuePending } = await import("../backend/src/services/queue.service.js"),
  { initializeSearch } =
    await import("../backend/src/services/search-schema.service.js");
let worker: ChildProcess | undefined,
  senderId = "",
  log = "",
  failed: unknown;
const report: { checks: { name: string; status: string }[]; failure?: string } =
  { checks: [] };
async function stop() {
  if (!worker || worker.exitCode !== null) return;
  const ended = once(worker, "exit");
  worker.kill("SIGTERM");
  const timer = setTimeout(() => worker?.kill("SIGKILL"), 12000);
  await ended;
  clearTimeout(timer);
}
try {
  await initializeSearch();
  await db.query(
    "INSERT INTO users(id,email,name,slack_webhook) VALUES($1,$2,$3,$4)",
    [
      userId,
      `${userId}@example.com`,
      "Authorized Slack verification",
      ciphertext,
    ],
  );
  const sender = await SenderService.create(
    userId,
    "Slack verification sender",
  );
  senderId = sender.id;
  await BatchModel.create(
    userId,
    {
      senderId,
      subject: "Reachflow integration verification",
      body: "Captured Ethereal test used to trigger one authorized rate-limit notification.",
      recipients: ["slack-verification@example.com"],
      startAt: new Date(Date.now() + 3000).toISOString(),
      delayMs: 2000,
      hourlyLimit: 1,
    },
    randomUUID(),
  );
  await enqueuePending();
  worker = spawn(
    process.execPath,
    ["--import", "tsx", "backend/src/workers/email.worker.ts"],
    {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  worker.stdout!.on("data", (chunk) => (log += chunk));
  worker.stderr!.on("data", (chunk) => (log += chunk));
  const deadline = Date.now() + 30000;
  let verified = false;
  while (Date.now() < deadline) {
    const row = (
      await db.query(
        "SELECT e.status,n.sent_at notification_sent FROM emails e LEFT JOIN notifications n ON n.user_id=e.user_id WHERE e.user_id=$1",
        [userId],
      )
    ).rows[0];
    if (row?.notification_sent) {
      report.checks.push({
        name: "Slack accepted the real worker-generated hourly-limit notification",
        status: "passed",
      });
      assert.equal(
        Number(
          (
            await db.query(
              "SELECT count(*) FROM notifications WHERE user_id=$1",
              [userId],
            )
          ).rows[0].count,
        ),
        1,
      );
      verified = true;
      break;
    }
    if (worker.exitCode !== null)
      throw Error("Worker exited before notification");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!verified)
    throw Error("No successful Slack acknowledgement within 30 seconds.");
  await stop();
  console.log(
    "PASS One real worker-generated Slack rate-limit alert acknowledged",
  );
  report.checks.push({
    name: "Exactly one test limit event was created",
    status: "passed",
  });
} catch (error) {
  failed = error;
  report.failure = error instanceof Error ? error.message : String(error);
  console.error("SLACK CHECK FAILED:", report.failure);
} finally {
  await stop();
  await emails.obliterate({ force: true });
  await maintenance.obliterate({ force: true });
  await Promise.all([emails.close(), maintenance.close()]);
  await db.query("DELETE FROM notifications WHERE user_id=$1", [userId]);
  await db.query("DELETE FROM emails WHERE user_id=$1", [userId]);
  await db.query("DELETE FROM batches WHERE user_id=$1", [userId]);
  await db.query("DELETE FROM senders WHERE user_id=$1", [userId]);
  await db.query("DELETE FROM users WHERE id=$1", [userId]);
  if (senderId) await redis.del(`sender-limit:${senderId}`);
  await fetch(`${process.env.ELASTIC_URL}/${index}`, {
    method: "DELETE",
  }).catch(() => {});
  await Promise.all([redis.quit(), db.end()]);
  await mkdir(".cache", { recursive: true });
  await writeFile(
    ".cache/slack-live-verification.json",
    JSON.stringify({ timestamp: new Date().toISOString(), ...report }, null, 2),
  );
}
if (failed) process.exitCode = 1;
