import type { RequestHandler } from "express";
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.auth) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  if (req.auth.role !== "operator") {
    res.status(403).json({ error: "Operator access is required." });
    return;
  }
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("origin") !== process.env.WEB_URL
  ) {
    res.status(403).json({ error: "Invalid request origin." });
    return;
  }
  next();
};
