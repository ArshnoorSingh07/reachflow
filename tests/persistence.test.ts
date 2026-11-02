import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
test(
  "PostgreSQL batch retries are idempotent and another user cannot use the sender",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    assert.match(
      url.pathname,
      /_test$/,
      "Use a separate database whose name ends in _test",
    );
    process.env.DATABASE_URL = url.toString();
    process.env.REDIS_URL ??= "redis://localhost:6379";
    process.env.ELASTIC_URL ??= "http://localhost:9200";
    process.env.SESSION_SECRET ??= randomBytes(32).toString("hex");
    process.env.ENCRYPTION_KEY ??= randomBytes(32).toString("hex");
    const { db } = await import("../backend/src/config/database.js");
    const { BatchModel } = await import("../backend/src/models/batch.model.js");
    const user = `test-${randomUUID()}`,
      sender = randomUUID();
    try {
      await db.query("INSERT INTO users(id,email,name) VALUES($1,$2,$3)", [
        user,
        `${user}@example.com`,
        "Integration test",
      ]);
      await db.query(
        "INSERT INTO senders(id,user_id,name,email,smtp_user,smtp_password,smtp_host,smtp_port) VALUES($1,$2,$3,$4,$4,$5,$6,587)",
        [
          sender,
          user,
          "Test",
          "test@example.com",
          "encrypted-placeholder",
          "smtp.ethereal.email",
        ],
      );
      const data = {
        senderId: sender,
        recipients: [
          "first@example.com",
          "second@example.com",
          "first@example.com",
        ],
        subject: "Idempotent batch",
        body: "Hello",
        startAt: new Date(Date.now() + 3600000).toISOString(),
        delayMs: 2000,
        hourlyLimit: 200,
      };
      const key = randomUUID();
      const [a, b] = await Promise.all([
        BatchModel.create(user, data, key),
        BatchModel.create(user, data, key),
      ]);
      assert.equal(a.batchId, b.batchId);
      const { rows } = await db.query(
        "SELECT id,recipient,scheduled_at FROM emails WHERE batch_id=$1 ORDER BY scheduled_at",
        [a.batchId],
      );
      assert.equal(rows.length, 2);
      const { EmailModel } =
        await import("../backend/src/models/email.model.js");
      assert.equal(
        (await EmailModel.findById(rows[0].id, user)).recipient,
        "first@example.com",
      );
      assert.equal(
        await EmailModel.findById(rows[0].id, "another-user"),
        undefined,
      );
      assert.equal(
        new Date(rows[1].scheduled_at).getTime() -
          new Date(rows[0].scheduled_at).getTime(),
        2000,
      );
      await assert.rejects(
        () => BatchModel.create(user, { ...data, subject: "Different" }, key),
        /Idempotency key/,
      );
      await assert.rejects(
        () => BatchModel.create("another-user", data, randomUUID()),
        /Sender not found/,
      );
      assert.deepEqual(await EmailModel.stats(user), {
        scheduled: 2,
        sent: 0,
        failed: 0,
        sentToday: 0,
      });
      await db.query(
        "UPDATE emails SET status='sent',sent_at=now() WHERE id=$1",
        [rows[0].id],
      );
      await db.query(
        "UPDATE emails SET status='sent',sent_at=now()-interval '2 days' WHERE id=$1",
        [rows[1].id],
      );
      assert.deepEqual(await EmailModel.stats(user), {
        scheduled: 0,
        sent: 2,
        failed: 0,
        sentToday: 1,
      });
    } finally {
      await db.query("DELETE FROM emails WHERE user_id=$1", [user]);
      await db.query("DELETE FROM batches WHERE user_id=$1", [user]);
      await db.query("DELETE FROM senders WHERE user_id=$1", [user]);
      await db.query("DELETE FROM users WHERE id=$1", [user]);
      await db.end();
    }
  },
);
