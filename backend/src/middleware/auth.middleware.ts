import type { RequestHandler } from "express";
import { equalToken } from "../services/access-policy.service.js";
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.auth) {
    res
      .status(401)
      .json({ error: "Sign in to continue.", code: "UNAUTHENTICATED" });
    return;
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (
      req.get("origin") !== process.env.WEB_URL ||
      !equalToken(req.session.csrfToken, req.get("x-csrf-token"))
    ) {
      res
        .status(403)
        .json({
          error:
            "Your security token is invalid. Refresh this page and try again.",
          code: "CSRF_INVALID",
        });
      return;
    }
  }
  next();
};
