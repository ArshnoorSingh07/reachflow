import type { Request } from "express";
import { randomBytes } from "node:crypto";
import type { Identity } from "../models/user.model.js";
export async function establishSession(
  req: Request,
  user: Identity,
  sessionVersion: number,
) {
  await new Promise<void>((resolve, reject) =>
    req.session.regenerate((e) => (e ? reject(e) : resolve())),
  );
  req.session.user = user;
  req.session.sessionVersion = sessionVersion;
  req.session.authenticatedAt = Date.now();
  req.session.lastActivityAt = Date.now();
  req.session.csrfToken = randomBytes(32).toString("hex");
  await new Promise<void>((resolve, reject) =>
    req.session.save((e) => (e ? reject(e) : resolve())),
  );
}
