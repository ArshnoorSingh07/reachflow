import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import request from "supertest";
import { createSessionAuthentication } from "../backend/src/middleware/session.middleware.js";
import { requireAuth } from "../backend/src/middleware/auth.middleware.js";
import { requireAdmin } from "../backend/src/middleware/admin.middleware.js";
import {
  equalToken,
  sessionExpired,
} from "../backend/src/services/access-policy.service.js";
const token = "a".repeat(64),
  member = {
    id: "member",
    email: "member@example.com",
    name: "Member",
    avatar: "",
    session_version: 0,
    disabled_at: null,
  };
function fixture(
  options: {
    signedIn?: boolean;
    account?: typeof member | undefined;
    version?: number;
    authenticatedAt?: number;
    lastActivityAt?: number;
    sessionEmail?: string;
  } = {},
) {
  const app = express();
  app.use(
    session({
      secret: "test-only-session-secret-at-least-32-characters",
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use((req, _res, next) => {
    if (options.signedIn) {
      req.session.user = {
        id: "member",
        name: "Forged profile",
        email: options.sessionEmail ?? member.email,
        avatar: "",
      };
      req.session.authenticatedAt = options.authenticatedAt ?? Date.now();
      req.session.lastActivityAt = options.lastActivityAt ?? Date.now();
      req.session.sessionVersion = options.version ?? 0;
      req.session.csrfToken = token;
    }
    next();
  });
  app.use(
    createSessionAuthentication(async () =>
      Object.hasOwn(options, "account") ? options.account : member,
    ),
  );
  app.all("/private", requireAuth, (req, res) =>
    res.json({ id: req.auth!.id, name: req.auth!.name }),
  );
  app.all("/operator", requireAdmin, (_req, res) => res.sendStatus(204));
  return app;
}
process.env.WEB_URL = "http://localhost:5173";
process.env.ADMIN_EMAILS = " Operator@Example.com ";
test("unauthenticated API access returns JSON 401", async () => {
  const response = await request(fixture()).get("/private").expect(401);
  assert.equal(response.body.code, "UNAUTHENTICATED");
});
test("valid sessions reload the identity from the database rather than trusting a stored profile", async () => {
  const response = await request(fixture({ signedIn: true }))
    .get("/private")
    .expect(200);
  assert.equal(response.body.name, "Member");
});
test("idle/absolute expiry and revoked/missing users cannot access protected APIs", async () => {
  for (const options of [
    { lastActivityAt: Date.now() - 3600001 },
    { authenticatedAt: Date.now() - 86400001 },
    { version: 1 },
    { account: undefined },
  ])
    await request(fixture({ signedIn: true, ...options }))
      .get("/private")
      .expect(401);
});
test("disabled accounts cannot use an existing session", async () => {
  await request(
    fixture({
      signedIn: true,
      account: { ...member, disabled_at: new Date() } as any,
    }),
  )
    .get("/private")
    .expect(401);
});
test("writes require both trusted origin and the session-bound CSRF token", async () => {
  const app = fixture({ signedIn: true });
  await request(app)
    .post("/private")
    .set("Origin", "http://localhost:5173")
    .expect(403);
  await request(app)
    .post("/private")
    .set("Origin", "https://attacker.example")
    .set("X-CSRF-Token", token)
    .expect(403);
  await request(app)
    .post("/private")
    .set("Origin", "http://localhost:5173")
    .set("X-CSRF-Token", "wrong")
    .expect(403);
  await request(app)
    .post("/private")
    .set("Origin", "http://localhost:5173")
    .set("X-CSRF-Token", token)
    .expect(200);
});
test("a forged operator email in the session cannot grant operator privileges", async () => {
  await request(
    fixture({ signedIn: true, sessionEmail: "operator@example.com" }),
  )
    .get("/operator")
    .expect(403);
  await request(fixture()).get("/operator").expect(401);
  await request(
    fixture({
      signedIn: true,
      account: { ...member, email: "operator@example.com" },
    }),
  )
    .get("/operator")
    .expect(204);
});
test("operator mutation endpoints still reject cross-origin requests", async () => {
  await request(
    fixture({
      signedIn: true,
      account: { ...member, email: "operator@example.com" },
    }),
  )
    .post("/operator")
    .set("Origin", "https://attacker.example")
    .expect(403);
});
test("token comparisons reject malformed Unicode without throwing", () => {
  assert.equal(equalToken("a".repeat(64), "é".repeat(64)), false);
  assert.equal(
    sessionExpired(
      Date.now() + 10000,
      Date.now(),
      Date.now(),
      3600000,
      86400000,
    ),
    true,
  );
});
