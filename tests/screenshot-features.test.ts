import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import {
  hashPassword,
  verifyPassword,
} from "../backend/src/services/password.service.js";
import {
  sanitizeRichText,
  richTextToPlain,
  decodeAttachment,
} from "../backend/src/services/message-content.service.js";
test("password hashes use independent salts and verify without storing plaintext", async () => {
  const password = "a-long-test-password";
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.ok(!a.includes(password));
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword("wrong", a), false);
});
test("rich HTML keeps formatting and strips executable content and remote images", () => {
  const html = sanitizeRichText(
    '<p style="text-align:center;background:url(https://bad.test)"><strong>Hello</strong><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">link</a></p>',
  );
  assert.match(html, /<strong>Hello<\/strong>/);
  assert.match(html, /text-align:center/);
  assert.doesNotMatch(html, /script|onerror|<img|javascript|background/);
  assert.match(richTextToPlain(html), /Hello/);
  assert.throws(() =>
    decodeAttachment({
      name: "fake.png",
      type: "image/png",
      data: Buffer.from("not a PNG").toString("base64"),
    }),
  );
});
test(
  "password sessions, rich scheduling, private attachments and message actions work against real PostgreSQL/Redis",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    assert.match(new URL(process.env.TEST_DATABASE_URL!).pathname, /_test$/);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.REDIS_URL =
      process.env.TEST_REDIS_URL ?? "redis://localhost:6379";
    process.env.ELASTIC_URL = "http://localhost:9200";
    process.env.SESSION_SECRET = randomBytes(32).toString("hex");
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
    process.env.WEB_URL = "http://localhost:5173";
    process.env.API_URL = "http://localhost:4000";
    process.env.QUEUE_PREFIX = `features-${randomUUID()}`;
    const email = `features-${randomUUID()}@example.com`,
      otherEmail = `features-${randomUUID()}@example.com`,
      password = "long-features-test-password";
    process.env.ADMIN_EMAILS = email;
    const { default: request } = await import("supertest");
    const { app, sessionClient } = await import("../backend/src/app.js");
    const { db } = await import("../backend/src/config/database.js");
    const { redis } = await import("../backend/src/config/redis.js");
    const { emails, maintenance } =
      await import("../backend/src/config/queues.js");
    app.set("trust proxy", true); // Isolated test process; use distinct forwarded fixture IPs.
    const agent = request
        .agent(app)
        .set(
          "X-Forwarded-For",
          `2001:db8:${randomBytes(2).toString("hex")}::1`,
        ),
      other = request
        .agent(app)
        .set(
          "X-Forwarded-For",
          `2001:db8:${randomBytes(2).toString("hex")}::2`,
        );
    let uid = "",
      otherUid = "",
      token = "",
      otherToken = "",
      batchId = "";
    try {
      await agent
        .post("/auth/register")
        .set("Origin", "https://wrong.test")
        .send({ email, password })
        .expect(403);
      await agent
        .post("/auth/register")
        .set("Origin", process.env.WEB_URL)
        .send({ email, password: "short" })
        .expect(400);
      await agent
        .post("/auth/register")
        .set("Origin", process.env.WEB_URL)
        .send({ email, password, firstName: "Arshnoor", lastName: "Singh" })
        .expect(201);
      const me = (await agent.get("/api/me").expect(200)).body;
      uid = me.user.id;
      token = me.csrfToken;
      assert.equal(me.user.isAdmin, false);
      assert.equal(me.user.name, "Arshnoor Singh");
      assert.equal(new URL(me.user.avatar).searchParams.get("seed"), "AS");
      const stored = (
        await db.query(
          "SELECT password_hash FROM password_credentials WHERE user_id=$1",
          [uid],
        )
      ).rows[0].password_hash;
      assert.match(stored, /^scrypt\$/);
      await agent
        .post("/api/logout")
        .set("Origin", process.env.WEB_URL)
        .set("X-CSRF-Token", token)
        .expect(204);
      await agent
        .post("/auth/login")
        .set("Origin", process.env.WEB_URL)
        .send({ email, password: "wrong" })
        .expect(401);
      await agent
        .post("/auth/login")
        .set("Origin", process.env.WEB_URL)
        .send({ email, password })
        .expect(200);
      token = (await agent.get("/api/me")).body.csrfToken;
      await other
        .post("/auth/register")
        .set("Origin", process.env.WEB_URL)
        .send({ email: otherEmail, password })
        .expect(201);
      const otherMe = (await other.get("/api/me")).body;
      otherUid = otherMe.user.id;
      otherToken = otherMe.csrfToken;
      const sender = randomUUID();
      await db.query(
        "INSERT INTO senders VALUES($1,$2,'Test','sender@ethereal.email','smtp-user','unused','smtp.ethereal.email',587)",
        [sender, uid],
      );
      const payload = {
        senderId: sender,
        subject: "Rich features",
        body: "Hello",
        bodyHtml: "<p><strong>Hello</strong><script>bad()</script></p>",
        attachments: [
          {
            name: "notes.txt",
            type: "text/plain",
            data: Buffer.from("Private attachment").toString("base64"),
          },
        ],
        recipients: ["capture@example.com"],
        startAt: new Date(Date.now() + 86400000).toISOString(),
        delayMs: 2000,
        hourlyLimit: 200,
      };
      const scheduled = await agent
        .post("/api/schedule")
        .set("Origin", process.env.WEB_URL)
        .set("X-CSRF-Token", token)
        .set("idempotency-key", randomUUID())
        .send(payload)
        .expect(202);
      batchId = scheduled.body.batchId;
      const record = (
        await db.query("SELECT * FROM emails WHERE batch_id=$1", [batchId])
      ).rows[0];
      assert.match(record.body_html, /<strong>Hello/);
      assert.doesNotMatch(record.body_html, /script/);
      const detail = (await agent.get(`/api/emails/${record.id}`).expect(200))
        .body;
      assert.equal(detail.attachments.length, 1);
      const path = `/api/emails/${record.id}/attachments/${detail.attachments[0].id}`;
      const downloaded = await agent.get(path).expect(200);
      assert.equal(downloaded.text, "Private attachment");
      await other.get(path).expect(404);
      await request(app).get(path).expect(401);
      await other
        .patch(`/api/emails/${record.id}`)
        .set("Origin", process.env.WEB_URL)
        .set("X-CSRF-Token", otherToken)
        .send({ starred: true })
        .expect(404);
      await agent
        .patch(`/api/emails/${record.id}`)
        .set("Origin", process.env.WEB_URL)
        .set("X-CSRF-Token", token)
        .send({ starred: true })
        .expect(204);
      assert.equal(
        (await agent.get("/api/emails?view=starred")).body.rows.some(
          (x: any) => x.id === record.id,
        ),
        true,
      );
      await agent
        .patch(`/api/emails/${record.id}`)
        .set("Origin", process.env.WEB_URL)
        .set("X-CSRF-Token", token)
        .send({ action: "delete" })
        .expect(409);
      await db.query(
        "UPDATE emails SET status='sent',sent_at=now() WHERE id=$1",
        [record.id],
      );
      for (const action of ["archive", "restore", "delete", "restore"]) {
        await agent
          .patch(`/api/emails/${record.id}`)
          .set("Origin", process.env.WEB_URL)
          .set("X-CSRF-Token", token)
          .send({ action })
          .expect(204);
        const view =
          action === "archive"
            ? "archived"
            : action === "delete"
              ? "trash"
              : "sent";
        assert.equal(
          (await agent.get(`/api/emails?view=${view}`)).body.rows.some(
            (x: any) => x.id === record.id,
          ),
          true,
        );
      }
    } finally {
      if (token)
        await agent
          .post("/api/logout")
          .set("Origin", process.env.WEB_URL)
          .set("X-CSRF-Token", token);
      if (otherToken)
        await other
          .post("/api/logout")
          .set("Origin", process.env.WEB_URL)
          .set("X-CSRF-Token", otherToken);
      await emails.obliterate({ force: true });
      await maintenance.obliterate({ force: true });
      for (const id of [uid, otherUid].filter(Boolean)) {
        await db.query(
          "DELETE FROM attachments WHERE batch_id IN (SELECT id FROM batches WHERE user_id=$1)",
          [id],
        );
        await db.query("DELETE FROM emails WHERE user_id=$1", [id]);
        await db.query("DELETE FROM batches WHERE user_id=$1", [id]);
        await db.query("DELETE FROM senders WHERE user_id=$1", [id]);
        await db.query("DELETE FROM password_credentials WHERE user_id=$1", [
          id,
        ]);
        await db.query("DELETE FROM users WHERE id=$1", [id]);
      }
      await Promise.all([
        emails.close(),
        maintenance.close(),
        sessionClient.quit(),
      ]);
      await redis.quit();
      await db.end();
    }
  },
);

test("SMTP MIME includes rich HTML, plain text and the stored attachment", async () => {
  const { default: nodemailer } = await import("nodemailer");
  const { mailMessage } =
    await import("../backend/src/services/mail-message.service.js");
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
  const info = await transport.sendMail(
    mailMessage(
      {
        id: randomUUID(),
        sender_email: "sender@example.com",
        recipient: "capture@example.com",
        subject: "Rich MIME",
        body: "Hello",
        body_html: "<p><strong>Hello</strong></p>",
      },
      [
        {
          name: "notes.txt",
          content_type: "text/plain",
          content: Buffer.from("Private attachment"),
        },
      ],
    ),
  );
  const raw = info.message.toString();
  assert.match(raw, /multipart\/mixed/);
  assert.match(raw, /text\/html/);
  assert.match(raw, /<strong>Hello<\/strong>/);
  assert.match(raw, /filename=notes.txt/);
  assert.match(raw, /UHJpdmF0ZSBhdHRhY2htZW50/);
});

test("DiceBear avatars use first and last name initials and omit identifying profile data", async () => {
  const { nameInitials, profileAvatar } =
    await import("../backend/src/utils/avatar.js");
  assert.equal(nameInitials("Arshnoor Singh"), "AS");
  assert.equal(nameInitials("  Alex James Morgan  "), "AM");
  assert.equal(nameInitials("Prince"), "P");
  const url = new URL(profileAvatar("Arshnoor Singh"));
  assert.equal(url.pathname, "/10.x/initials/svg");
  assert.equal(url.searchParams.get("seed"), "AS");
  assert.doesNotMatch(url.toString(), /Arshnoor|Singh/);
});
