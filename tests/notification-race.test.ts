import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
test(
  "concurrent notification snapshots do not post a second alert after the first sender finishes",
  { skip: !process.env.TEST_DATABASE_URL || !process.env.TEST_REDIS_URL },
  async () => {
    assert.ok(
      new URL(process.env.TEST_DATABASE_URL!).pathname.endsWith("_test"),
    );
    Object.assign(process.env, {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      REDIS_URL: process.env.TEST_REDIS_URL,
      ELASTIC_URL: "http://localhost:9200",
      SESSION_SECRET: randomBytes(32).toString("hex"),
      ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    });
    const { db } = await import("../backend/src/config/database.js"),
      { redis } = await import("../backend/src/config/redis.js"),
      { seal } = await import("../backend/src/utils/encryption.js"),
      { notify } =
        await import("../backend/src/services/notification.service.js");
    let posts = 0;
    const server = createServer((req, res) => {
      posts++;
      req.resume();
      res.end("ok");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as { port: number }).port,
      id = randomUUID(),
      sender = randomUUID(),
      user = `notification-test-${id}`;
    const originalQuery = db.query.bind(db),
      originalSet = redis.set.bind(redis);
    let reads = 0,
      locks = 0;
    let bothRead!: () => void, firstDone!: () => void;
    const readBarrier = new Promise<void>((resolve) => (bothRead = resolve)),
      firstFinished = new Promise<void>((resolve) => (firstDone = resolve));
    try {
      await db.query(
        "INSERT INTO users(id,email,name,slack_webhook) VALUES($1,$2,$3,$4)",
        [
          user,
          `${user}@example.com`,
          "Notification race fixture",
          seal(`http://127.0.0.1:${port}`),
        ],
      );
      await db.query(
        "INSERT INTO senders(id,user_id,name,email,smtp_user,smtp_password,smtp_host,smtp_port) VALUES($1,$2,$3,$4,$4,$5,$6,587)",
        [
          sender,
          user,
          "Fixture",
          "fixture@example.com",
          "unused",
          "smtp.ethereal.email",
        ],
      );
      await db.query(
        "INSERT INTO notifications(id,user_id,sender_id) VALUES($1,$2,$3)",
        [id, user, sender],
      );
      (db as any).query = async (...args: any[]) => {
        const result = await (originalQuery as any)(...args);
        if (
          typeof args[0] === "string" &&
          args[0].startsWith("SELECT n.*") &&
          reads < 2
        ) {
          reads++;
          if (reads === 2) bothRead();
          await readBarrier;
        }
        return result;
      };
      (redis as any).set = async (...args: any[]) => {
        if (args[0] === `notification-lock:${id}` && ++locks === 2)
          await firstFinished;
        return (originalSet as any)(...args);
      };
      const first = notify(id);
      const second = notify(id);
      first.then(firstDone, firstDone);
      await Promise.all([first, second]);
      assert.equal(posts, 1);
      assert.ok(
        (
          await originalQuery("SELECT sent_at FROM notifications WHERE id=$1", [
            id,
          ])
        ).rows[0].sent_at,
      );
    } finally {
      (db as any).query = originalQuery;
      (redis as any).set = originalSet;
      await db.query("DELETE FROM notifications WHERE id=$1", [id]);
      await db.query("DELETE FROM senders WHERE id=$1", [sender]);
      await db.query("DELETE FROM users WHERE id=$1", [user]);
      await redis.del(`notification-lock:${id}`);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await Promise.all([db.end(), redis.quit()]);
    }
  },
);
