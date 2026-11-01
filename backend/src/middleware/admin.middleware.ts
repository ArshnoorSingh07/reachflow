import type { RequestHandler } from "express";
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (
    !req.session.user ||
    !(process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .includes(req.session.user.email)
  ) {
    res.sendStatus(403);
    return;
  }
  next();
};
