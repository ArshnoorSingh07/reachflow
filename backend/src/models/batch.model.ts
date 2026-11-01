import { db } from "../config/database.js";
import { randomUUID, createHash } from "node:crypto";
import type { ScheduleInput } from "../validators/email.validator.js";
export const BatchModel = {
  async create(uid: string, data: ScheduleInput, key: string) {
    if (
      !(
        await db.query("SELECT id FROM senders WHERE id=$1 AND user_id=$2", [
          data.senderId,
          uid,
        ])
      ).rowCount
    ) {
      throw Object.assign(new Error("Sender not found"), { status: 404 });
    }
    const hash = createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
    const client = await db.connect();
    let batchId = randomUUID();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        "INSERT INTO batches VALUES($1,$2,$3,$4) ON CONFLICT(user_id,idempotency_key) DO NOTHING RETURNING id",
        [batchId, uid, key, hash],
      );
      if (!inserted.rowCount) {
        const old = (
          await client.query(
            "SELECT id,payload_hash FROM batches WHERE user_id=$1 AND idempotency_key=$2",
            [uid, key],
          )
        ).rows[0];
        if (old.payload_hash !== hash) {
          await client.query("ROLLBACK");
          throw Object.assign(
            new Error("Idempotency key already used for different content"),
            { status: 409 },
          );
        }
        batchId = old.id;
      } else {
        if (new Date(data.startAt).getTime() < Date.now() - 60000)
          throw Object.assign(new Error("Choose a start time in the future."), {
            status: 400,
          });
        await client.query(
          `INSERT INTO emails(id,user_id,batch_id,sender_id,recipient,subject,body,scheduled_at,delay_ms,hourly_limit)
          SELECT gen_random_uuid(),$1,$2::uuid,$3::uuid,recipient,$5,$6,
          $7::timestamptz + ((ordinality-1)*$8::int)*interval '1 millisecond',$8,$9
          FROM unnest($4::text[]) WITH ORDINALITY AS leads(recipient,ordinality)`,
          [
            uid,
            batchId,
            data.senderId,
            [...new Set(data.recipients)],
            data.subject,
            data.body,
            data.startAt,
            data.delayMs,
            data.hourlyLimit,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    return { batchId };
  },
};
