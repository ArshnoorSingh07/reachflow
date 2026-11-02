import { randomUUID } from "node:crypto";
import { db } from "../config/database.js";
import { redis } from "../config/redis.js";
import { unseal } from "../utils/encryption.js";
export async function notify(eventId?: string) {
  const { rows } = await db.query(
    "SELECT n.*,u.slack_webhook,s.email FROM notifications n JOIN users u ON u.id=n.user_id JOIN senders s ON s.id=n.sender_id WHERE n.sent_at IS NULL AND u.slack_webhook IS NOT NULL AND ($1::text IS NULL OR n.id=$1) ORDER BY n.created_at LIMIT 50",
    [eventId ?? null],
  );
  for (const n of rows) {
    const lock = `notification-lock:${n.id}`;
    const token = randomUUID();
    if (!(await redis.set(lock, token, "PX", 15000, "NX"))) continue;
    try {
      // Another notifier may have finished after this batch snapshot was read.
      const fresh = (
        await db.query(
          "SELECT n.id,u.slack_webhook FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.id=$1 AND n.sent_at IS NULL AND u.slack_webhook IS NOT NULL",
          [n.id],
        )
      ).rows[0];
      if (!fresh) continue;
      const r = await fetch(unseal(fresh.slack_webhook), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: `⚠️ Reachflow: ${n.email} has reached its hourly email limit. Remaining emails will resume in the next hour.`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error(`Slack: ${r.status}`);
      await db.query("UPDATE notifications SET sent_at=now() WHERE id=$1", [
        n.id,
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      await redis.eval(
        "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
        1,
        lock,
        token,
      );
    }
  }
}
