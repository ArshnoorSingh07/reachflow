import { profileAvatar } from "../utils/avatar.js";
import type { RequestHandler } from "express";
import { randomBytes } from "node:crypto";
import {
  sessionExpired,
  isOperator,
} from "../services/access-policy.service.js";
type Account = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  session_version: number;
  disabled_at: Date | null;
  auth_provider?: string;
};
export function createSessionAuthentication(
  findUser: (id: string) => Promise<Account | undefined>,
  options = { idleMs: 3600000, absoluteMs: 86400000 },
): RequestHandler {
  return async (req, res, next) => {
    if (!req.session.user) {
      next();
      return;
    }
    try {
      const now = Date.now();
      const account = await findUser(req.session.user.id);
      if (
        !account ||
        account.disabled_at ||
        account.session_version !== req.session.sessionVersion ||
        sessionExpired(
          req.session.authenticatedAt,
          req.session.lastActivityAt,
          now,
          options.idleMs,
          options.absoluteMs,
        )
      ) {
        await new Promise<void>((resolve, reject) =>
          req.session.destroy((error) => (error ? reject(error) : resolve())),
        );
        res.clearCookie("reachflow.sid");
        next();
        return;
      }
      const user = {
        id: account.id,
        name: account.name,
        email: account.email,
        avatar: profileAvatar(account.name),
        provider:
          account.auth_provider === "password"
            ? ("password" as const)
            : ("google" as const),
      };
      req.auth = {
        ...user,
        role:
          account.auth_provider !== "password" && isOperator(account.email)
            ? "operator"
            : "member",
      };
      req.session.user = user;
      req.session.lastActivityAt = now;
      req.session.csrfToken ??= randomBytes(32).toString("hex");
      next();
    } catch (error) {
      next(error);
    }
  };
}
