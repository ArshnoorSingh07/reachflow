/** Opt-in live verification: isolated PostgreSQL/queue/index fixtures, real Ethereal SMTP. */
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import signature from "cookie-signature";
if (process.env.LIVE_SMTP !== "1")
  throw Error(
    "Run with LIVE_SMTP=1 to explicitly enable captured Ethereal test sends.",
  );
const testDatabase = process.env.TEST_DATABASE_URL;
if (!testDatabase || !new URL(testDatabase).pathname.endsWith("_test"))
  throw Error("A separate TEST_DATABASE_URL ending in _test is required");
const runId = randomUUID(),
  prefix = `verify-${runId}`,
  index = `test-verify-${runId}`;
Object.assign(process.env, {
  DATABASE_URL: testDatabase,
  QUEUE_PREFIX: prefix,
  ELASTIC_INDEX: index,
  NODE_ENV: "test",
  PORT: "4101",
  SESSION_SECRET: randomBytes(32).toString("hex"),
  API_URL: "http://localhost:4101",
  WEB_URL: "http://localhost:5173",
});
const { db } = await import("../backend/src/config/database.js"),
  { redis } = await import("../backend/src/config/redis.js"),
  { emails, maintenance } = await import("../backend/src/config/queues.js"),
  { initializeSearch } =
    await import("../backend/src/services/search-schema.service.js");
const base = "http://127.0.0.1:4101",
  checks: { name: string; status: string; detail?: string }[] = [],
  users = [`verify-owner-${runId}`, `verify-foreign-${runId}`],
  sessions: string[] = [],
  senderIds: string[] = [];
let worker: ChildProcess | undefined;
let apiProcess: ChildProcess | undefined;
let workerLog = "";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(
  condition: () => Promise<boolean>,
  label: string,
  timeout = 60000,
) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await condition()) return;
    await sleep(500);
  }
  throw Error(`${label}: timed out`);
}
async function check(name: string, action: () => Promise<void>) {
  await action();
  checks.push({ name, status: "passed" });
  console.log(`PASS ${name}`);
}
async function cookieFor(id: string) {
  const sid = randomBytes(24).toString("hex"),
    csrf = randomBytes(32).toString("hex");
  sessions.push(sid);
  await redis.set(
    "sess:" + sid,
    JSON.stringify({
      cookie: {
        originalMaxAge: 3600000,
        expires: new Date(Date.now() + 3600000).toISOString(),
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      },
      user: {
        id,
        name: "Verification fixture",
        email: `${id}@example.com`,
        avatar: "",
      },
      authenticatedAt: Date.now(),
      lastActivityAt: Date.now(),
      sessionVersion: 0,
      csrfToken: csrf,
    }),
    "EX",
    3600,
  );
  return {
    cookie: `reachflow.sid=${encodeURIComponent("s:" + signature.sign(sid, process.env.SESSION_SECRET!))}`,
    csrf,
  };
}
async function request(
  path: string,
  session?: { cookie: string; csrf: string },
  method = "GET",
  body?: unknown,
  key?: string,
) {
  const result = await fetch(base + path, {
    method,
    headers: {
      ...(session
        ? { cookie: session.cookie, "x-csrf-token": session.csrf }
        : {}),
      origin: process.env.WEB_URL!,
      "content-type": "application/json",
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  return {
    status: result.status,
    data: result.status === 204 ? null : await result.json(),
  };
}
async function startApi() {
  let log = "";
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "backend/src/server.ts"],
    {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  apiProcess = child;
  child.stdout!.on("data", (chunk) => (log += chunk));
  child.stderr!.on("data", (chunk) => (log += chunk));
  await waitFor(
    async () => {
      if (child.exitCode !== null)
        throw Error("API exited before ready: " + log.slice(-1000));
      return log.includes("API listening");
    },
    "API readiness",
    15000,
  );
}
async function stopApi() {
  const child = apiProcess;
  if (!child || child.exitCode !== null) return;
  const exit = once(child, "exit");
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 12000);
  await exit;
  clearTimeout(timer);
  apiProcess = undefined;
}
async function startWorker() {
  workerLog = "";
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "backend/src/workers/email.worker.ts"],
    {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  worker = child;
  child.stdout!.on("data", (chunk) => (workerLog += chunk));
  child.stderr!.on("data", (chunk) => (workerLog += chunk));
  await waitFor(
    async () => {
      if (child.exitCode !== null)
        throw Error("Worker exited before ready: " + workerLog.slice(-1000));
      return workerLog.includes("workers ready");
    },
    "worker readiness",
    15000,
  );
}
async function stopWorker() {
  const child = worker;
  if (!child || child.exitCode !== null) return;
  const exit = once(child, "exit");
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 12000);
  await exit;
  clearTimeout(timer);
  worker = undefined;
}
let failed: unknown;
try {
  await initializeSearch();
  await startApi();
  for (const id of users)
    await db.query("INSERT INTO users(id,email,name)VALUES($1,$2,$3)", [
      id,
      `${id}@example.com`,
      "Verification fixture",
    ]);
  const owner = await cookieFor(users[0]),
    foreign = await cookieFor(users[1]),
    secondSession = await cookieFor(users[0]);
  await check("Anonymous API and queue controls are protected", async () => {
    assert.equal((await request("/api/emails")).status, 401);
    assert.equal((await request("/queues")).status, 401);
    assert.equal((await request("/queues", owner)).status, 403);
  });
  await check("Authenticated profile and CSRF session contract", async () => {
    const r = await request("/api/me", owner);
    assert.equal(r.status, 200);
    assert.equal(r.data.user.id, users[0]);
    assert.equal(r.data.csrfToken, owner.csrf);
    const denied = await request(
      "/api/senders",
      { ...owner, csrf: "invalid" },
      "POST",
      { name: "Must not be created" },
    );
    assert.equal(denied.status, 403);
  });
  let first: any, second: any;
  await check(
    "Two distinct Ethereal senders are provisioned through the API",
    async () => {
      const a = await request("/api/senders", owner, "POST", {
        name: "Verification sender A",
      });
      assert.equal(a.status, 201, JSON.stringify(a.data));
      first = a.data;
      senderIds.push(first.id);
      const b = await request("/api/senders", owner, "POST", {
        name: "Verification sender B",
      });
      assert.equal(b.status, 201, JSON.stringify(b.data));
      second = b.data;
      senderIds.push(second.id);
      assert.notEqual(first.email, second.email);
    },
  );
  const payload = {
      senderId: first.id,
      subject: `Live scheduler verification ${runId}`,
      body: `Verificationneedle ${runId}. This message is captured by Ethereal and never delivered to a real inbox.`,
      bodyHtml: `<p><strong>Verificationneedle ${runId}</strong>. Captured by Ethereal.</p>`,
      attachments: [
        {
          name: "verification-notes.txt",
          type: "text/plain",
          data: Buffer.from(`Attachment verification ${runId}`).toString(
            "base64",
          ),
        },
      ],
      recipients: ["one@example.com", "two@example.com", "three@example.com"],
      startAt: new Date(Date.now() + 15000).toISOString(),
      delayMs: 2000,
      hourlyLimit: 2,
    },
    key = randomUUID();
  let batchId = "";
  let originalIds: string[] = [];
  await check(
    "Scheduling persists a batch and creates delayed BullMQ jobs",
    async () => {
      const r = await request("/api/schedule", owner, "POST", payload, key);
      assert.equal(r.status, 202, JSON.stringify(r.data));
      batchId = r.data.batchId;
      const { rows } = await db.query(
        "SELECT id FROM emails WHERE batch_id=$1 ORDER BY scheduled_at",
        [batchId],
      );
      originalIds = rows.map((r) => r.id);
      assert.equal(rows.length, 3);
      for (const id of originalIds)
        assert.equal(await (await emails.getJob(id))!.getState(), "delayed");
    },
  );
  await check(
    "Duplicate requests and changed-payload conflicts are handled safely",
    async () => {
      assert.equal(
        (await request("/api/schedule", owner, "POST", payload, key)).data
          .batchId,
        batchId,
      );
      assert.equal(
        (
          await request(
            "/api/schedule",
            owner,
            "POST",
            { ...payload, subject: "Changed" },
            key,
          )
        ).status,
        409,
      );
      assert.equal(
        Number(
          (
            await db.query("SELECT count(*) FROM emails WHERE batch_id=$1", [
              batchId,
            ])
          ).rows[0].count,
        ),
        3,
      );
    },
  );
  await check(
    "Foreign users cannot list, read, or schedule with another user’s resources",
    async () => {
      assert.equal((await request("/api/emails", foreign)).data.total, 0);
      assert.equal(
        (await request(`/api/emails/${originalIds[0]}`, foreign)).status,
        404,
      );
      assert.equal(
        (await request("/api/schedule", foreign, "POST", payload, randomUUID()))
          .status,
        404,
      );
    },
  );
  await check(
    "Future jobs and sessions survive actual API and worker process restarts",
    async () => {
      await startWorker();
      await stopWorker();
      await stopApi();
      await startApi();
      assert.equal((await request("/api/me", owner)).data.user.id, users[0]);
      assert.equal(
        Number(
          (
            await db.query(
              "SELECT count(*) FROM emails WHERE batch_id=$1 AND status='scheduled'",
              [batchId],
            )
          ).rows[0].count,
        ),
        3,
      );
      await startWorker();
    },
  );
  await check(
    "Real Ethereal SMTP sends two messages and defers quota overflow",
    async () => {
      await waitFor(
        async () => {
          const { rows } = await db.query(
            "SELECT status,error FROM emails WHERE batch_id=$1",
            [batchId],
          );
          const problem = rows.find((r) =>
            ["failed", "uncertain"].includes(r.status),
          );
          if (problem) throw Error(`SMTP delivery failed: ${problem.error}`);
          return rows.filter((r) => r.status === "sent").length === 2;
        },
        "live SMTP sending",
        90000,
      );
      await waitFor(async () => {
        const r = await db.query(
          "SELECT scheduled_at FROM emails WHERE batch_id=$1 AND status='scheduled'",
          [batchId],
        );
        return (
          r.rows.length === 1 &&
          new Date(r.rows[0].scheduled_at).getTime() >=
            Math.floor(Date.now() / 3600000) * 3600000 + 3600000
        );
      }, "hourly reschedule");
    },
  );
  await check(
    "Minimum spacing, rich-text/attachment persistence, Ethereal previews, and disconnected Slack behavior",
    async () => {
      const { rows } = await db.query(
        "SELECT sent_at,preview_url FROM emails WHERE batch_id=$1 AND status='sent' ORDER BY sent_at",
        [batchId],
      );
      assert.ok(
        new Date(rows[1].sent_at).getTime() -
          new Date(rows[0].sent_at).getTime() >=
          2000,
      );
      const rich = (
        await db.query(
          "SELECT body_html FROM emails WHERE batch_id=$1 LIMIT 1",
          [batchId],
        )
      ).rows[0];
      assert.match(rich.body_html, /<strong>Verificationneedle/);
      const attachment = (
        await db.query(
          "SELECT name,content FROM attachments WHERE batch_id=$1",
          [batchId],
        )
      ).rows;
      assert.equal(attachment.length, 1);
      assert.equal(
        attachment[0].content.toString(),
        `Attachment verification ${runId}`,
      );
      for (const r of rows) {
        assert.ok(r.preview_url?.startsWith("https://ethereal.email/message/"));
        const response = await fetch(r.preview_url, {
          signal: AbortSignal.timeout(15000),
        });
        assert.equal(response.status, 200);
      }
      assert.equal(
        Number(
          (
            await db.query(
              "SELECT count(*) FROM notifications WHERE user_id=$1 AND sent_at IS NULL",
              [users[0]],
            )
          ).rows[0].count,
        ),
        1,
      );
    },
  );
  await check(
    "Elasticsearch indexes message bodies and search remains tenant-scoped",
    async () => {
      await waitFor(
        async () => {
          const r = await request(
            "/api/emails?view=sent&q=Verificationneedle",
            owner,
          );
          return r.status === 200 && r.data.total === 2;
        },
        "search indexing",
        45000,
      );
      assert.equal(
        (
          await request(
            "/api/emails?view=scheduled&q=Verificationneedle",
            owner,
          )
        ).data.total,
        1,
      );
      assert.equal(
        (await request("/api/emails?view=sent&q=Verificationneedle", foreign))
          .data.total,
        0,
      );
    },
  );
  await check(
    "Completed jobs remain completed after another worker restart",
    async () => {
      await stopWorker();
      await startWorker();
      await sleep(2500);
      const { rows } = await db.query(
        "SELECT id,status FROM emails WHERE batch_id=$1",
        [batchId],
      );
      assert.equal(rows.filter((r) => r.status === "sent").length, 2);
      assert.deepEqual(rows.map((r) => r.id).sort(), [...originalIds].sort());
      for (const row of rows.filter((r) => r.status === "sent"))
        assert.equal(
          await (await emails.getJob(row.id))!.getState(),
          "completed",
        );
    },
  );
  await check(
    "A 1000-recipient burst is persisted and queued without sending it",
    async () => {
      const r = await request(
        "/api/schedule",
        owner,
        "POST",
        {
          ...payload,
          senderId: second.id,
          subject: `Future load test ${runId}`,
          startAt: new Date(Date.now() + 86400000).toISOString(),
          recipients: Array.from(
            { length: 1000 },
            (_, i) => `load-${i}@example.com`,
          ),
        },
        randomUUID(),
      );
      assert.equal(r.status, 202, JSON.stringify(r.data));
      const { rows } = await db.query(
        "SELECT id FROM emails WHERE batch_id=$1",
        [r.data.batchId],
      );
      assert.equal(rows.length, 1000);
      assert.ok(await emails.getJob(rows[999].id));
    },
  );
  await check(
    "Signing out all devices invalidates a second active session",
    async () => {
      assert.equal(
        (await request("/api/me", secondSession)).data.user.id,
        users[0],
      );
      assert.equal(
        (await request("/api/logout-all", owner, "POST")).status,
        204,
      );
      assert.equal((await request("/api/emails", secondSession)).status, 401);
    },
  );
} catch (error) {
  failed = error;
  console.error(
    "LIVE CHECK FAILED:",
    error instanceof Error ? error.message : String(error),
  );
  checks.push({
    name: "End-to-end run",
    status: "failed",
    detail: error instanceof Error ? error.message : String(error),
  });
} finally {
  await stopWorker();
  await emails.obliterate({ force: true });
  await maintenance.obliterate({ force: true });
  await Promise.all([emails.close(), maintenance.close()]);
  for (const id of users) {
    await db.query("DELETE FROM notifications WHERE user_id=$1", [id]);
    await db.query("DELETE FROM emails WHERE user_id=$1", [id]);
    await db.query(
      "DELETE FROM attachments WHERE batch_id IN (SELECT id FROM batches WHERE user_id=$1)",
      [id],
    );
    await db.query("DELETE FROM batches WHERE user_id=$1", [id]);
    await db.query("DELETE FROM senders WHERE user_id=$1", [id]);
    await db.query("DELETE FROM users WHERE id=$1", [id]);
  }
  for (const id of senderIds) await redis.del(`sender-limit:${id}`);
  for (const id of sessions) await redis.del("sess:" + id);
  await fetch(`${process.env.ELASTIC_URL}/${index}`, {
    method: "DELETE",
  }).catch(() => {});
  await stopApi();
  await Promise.all([redis.quit(), db.end()]);
  await mkdir(".cache", { recursive: true });
  await writeFile(
    ".cache/live-verification.json",
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        checks,
        failed: !!failed,
        notes: [
          "Authenticated API tests use isolated, server-signed fixture sessions; Google consent is not mocked or claimed.",
          "Emails are captured by Ethereal; no real recipient delivery.",
          "Slack OAuth/notification needs a separate live user consent check.",
        ],
      },
      null,
      2,
    ),
  );
}
if (failed) process.exitCode = 1;
