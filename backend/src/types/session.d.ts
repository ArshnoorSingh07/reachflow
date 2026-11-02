import "express-session";
import type { Identity } from "../models/user.model.js";
declare module "express-session" {
  interface SessionData {
    user?: Identity;
    authenticatedAt?: number;
    lastActivityAt?: number;
    sessionVersion?: number;
    csrfToken?: string;
    slackState?: string;
  }
}
declare global {
  namespace Express {
    interface Request {
      auth?: Identity & { role: "member" | "operator" };
    }
  }
}
