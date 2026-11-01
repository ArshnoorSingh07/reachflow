import { fileURLToPath } from "node:url";
import { getConfig } from "./controllers/config.controller.js";
import express from "express";
import session from "express-session";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";
import { authRouter } from "./routes/auth.routes.js";
import { emailRouter } from "./routes/email.routes.js";
import { senderRouter } from "./routes/sender.routes.js";
import { integrationRouter } from "./routes/integration.routes.js";
import { requireAuth } from "./middleware/auth.middleware.js";
import { requireAdmin } from "./middleware/admin.middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { queueDashboard } from "./config/queue-dashboard.js";
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  throw Error("Set a secure SESSION_SECRET");
const app = express();
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Cache-Control": "no-store",
  });
  next();
});
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
const store = createClient({ url: process.env.REDIS_URL });
await store.connect();
app.use(
  session({
    store: new RedisStore({ client: store }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400000,
    },
  }),
);

app.get("/api/config", getConfig);
app.get("/health", (_req, res) => res.json({ status: "ok" }));
// Public auth endpoints precede the protected API routes.
app.use(authRouter);
app.use("/api", requireAuth);
app.use(emailRouter, senderRouter, integrationRouter);
app.use("/queues", requireAdmin, queueDashboard);
if (process.env.NODE_ENV === "production") {
  const path = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
  app.use(
    express.static(path, { index: false, maxAge: "1y", immutable: true }),
  );
  app.get("/", (_req, res) =>
    res.sendFile("index.html", {
      root: path,
      headers: { "Cache-Control": "no-store" },
    }),
  );
}
app.use(errorHandler);
export { app, store as sessionClient };
