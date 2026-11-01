import type { RequestHandler } from "express";
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.user) {
    res.sendStatus(401);
    return;
  }
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("origin") !== process.env.WEB_URL
  ) {
    res.status(403).json({ error: "Invalid origin" });
    return;
  }
  next();
};
