import { classifyDeliveryFailure } from "../services/delivery-outcome.service.js";
import { Worker, DelayedError } from "bullmq";
import nodemailer from "nodemailer";
import { db } from "../config/database.js";
import { redis } from "../config/redis.js";
import { emails, maintenance } from "../config/queues.js";
import { unseal } from "../utils/encryption.js";
import { indexEmail } from "../services/search.service.js";
import { enqueuePending } from "../services/queue.service.js";
import {
  admissionScript,
  releaseSlotScript,
} from "../services/rate-limit.service.js";
import { notify } from "../services/notification.service.js";
const worker = new Worker(
  "emails",
  async (job, token) => {
    const client = await db.connect();
    let senderLock: string | undefined;
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "SELECT e.*,s.smtp_host,s.smtp_port,s.smtp_user,s.smtp_password,s.email AS sender_email FROM emails e JOIN senders s ON s.id=e.sender_id WHERE e.id=$1 FOR UPDATE OF e",
        [job.data.id],
      );
      const e = result.rows[0];
      if (!e || e.status !== "scheduled") {
        if (e?.status === "sending")
          await client.query(
            "UPDATE emails SET status='uncertain',error='Worker interrupted during SMTP; review Ethereal before retrying',version=version+1 WHERE id=$1",
            [e.id],
          );
        await client.query("COMMIT");
        return;
      }
      const lock = await client.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired",
        [e.sender_id],
      );
      if (!lock.rows[0].acquired) {
        await client.query("COMMIT");
        await job.moveToDelayed(Date.now() + 1000, token);
        throw new DelayedError();
      }
      senderLock = e.sender_id;
      const limit = Math.min(
        e.hourly_limit,
        Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 200),
      );
      const delay = Math.max(
        e.delay_ms,
        Number(process.env.MIN_SEND_DELAY_MS ?? 2000),
      );
      const [until, hit, hour] = (await redis.eval(
        admissionScript,
        1,
        `sender-limit:${e.sender_id}`,
        limit,
        delay,
      )) as number[];
      if (until) {
        await client.query(
          "UPDATE emails SET scheduled_at=$2,version=version+1 WHERE id=$1",
          [e.id, new Date(until)],
        );
        await client.query("COMMIT");
        await job.moveToDelayed(until, token);
        throw new DelayedError();
      }
      if (hit)
        await client.query(
          "INSERT INTO notifications(id,user_id,sender_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
          [`${e.sender_id}-${hour}`, e.user_id, e.sender_id],
        );
      await client.query(
        "UPDATE emails SET status='sending',version=version+1 WHERE id=$1",
        [e.id],
      );
      await client.query("COMMIT");
      const notification = (
        hit ? notify(`${e.sender_id}-${hour}`) : Promise.resolve()
      ).catch((error) =>
        console.error("Slack notification pending retry", error),
      );
      // Commit sending before SMTP: a stalled/restarted job will never blindly resend.
      let retryError: unknown;
      try {
        const transport = nodemailer.createTransport({
          host: e.smtp_host,
          port: e.smtp_port,
          secure: false,
          requireTLS: true,
          auth: { user: e.smtp_user, pass: unseal(e.smtp_password) },
          connectionTimeout: 10000,
          socketTimeout: 20000,
        });
        const info = await transport.sendMail({
          from: e.sender_email,
          to: e.recipient,
          subject: e.subject,
          text: e.body,
          messageId: `<${e.id}@reachflow.local>`,
        });
        await db.query(
          "UPDATE emails SET status='sent',sent_at=now(),preview_url=$2,version=version+1 WHERE id=$1",
          [e.id, nodemailer.getTestMessageUrl(info) || null],
        );
      } catch (error) {
        const outcome = classifyDeliveryFailure(error);
        await db.query(
          "UPDATE emails SET status=$2,error=$3,version=version+1 WHERE id=$1",
          [
            e.id,
            outcome === "retryable" ? "scheduled" : outcome,
            outcome === "uncertain"
              ? "SMTP outcome needs manual review: " + String(error)
              : String(error),
          ],
        );
        if (outcome === "retryable") retryError = error;
      }
      await redis.eval(
        releaseSlotScript,
        1,
        `sender-limit:${e.sender_id}`,
        delay,
      );
      await notification;
      if (retryError) throw retryError;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      if (senderLock)
        await client.query(
          "SELECT pg_advisory_unlock(hashtextextended($1,0))",
          [senderLock],
        );
      client.release();
    }
  },
  {
    connection: redis,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  },
);
worker.on("failed", async (job, error) => {
  console.error(error);
  if (job && job.attemptsMade >= Number(job.opts.attempts ?? 1))
    await db.query(
      "UPDATE emails SET status=CASE WHEN status='sending' THEN 'uncertain' ELSE 'failed' END,error=$2,version=version+1 WHERE id=$1 AND status IN ('scheduled','sending')",
      [job.data.id, error.message],
    );
});
worker.on("error", console.error);
// BullMQ recurring delayed jobs provide durable reconciliation; no cron library or OS cron.
await maintenance.upsertJobScheduler(
  "reconcile",
  { every: 10000 },
  {
    name: "reconcile",
    data: {},
    opts: { removeOnComplete: 10, removeOnFail: 20 },
  },
);
const reconciler = new Worker(
  "maintenance",
  async () => {
    await Promise.all([
      enqueuePending(),
      notify(),
      (async () => {
        const { rows } = await db.query(
          "SELECT id FROM emails WHERE indexed_version<version ORDER BY scheduled_at LIMIT 500",
        );
        for (const email of rows) {
          try {
            await indexEmail(email.id);
          } catch (error) {
            console.error("Search sync pending retry", error);
            break;
          }
        }
      })(),
    ]);
  },
  { connection: redis, concurrency: 1 },
);
reconciler.on("error", console.error);
async function shutdown() {
  await Promise.all([worker.close(), reconciler.close()]);
  await Promise.all([emails.close(), maintenance.close()]);
  await db.end();
  await redis.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
console.log("Email and reconciliation workers ready");
