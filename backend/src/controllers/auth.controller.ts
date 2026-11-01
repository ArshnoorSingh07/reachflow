import type { RequestHandler } from "express";
import { randomBytes } from "node:crypto";
import { google } from "../config/oauth.js";
import { authenticateGoogle } from "../services/auth.service.js";
export const googleLogin: RequestHandler = (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.redirect(`${process.env.WEB_URL}/?error=oauth`);
    return;
  }
  req.session.googleState = randomBytes(24).toString("hex");
  const url = google.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state: req.session.googleState,
  });
  req.session.save((error) => {
    if (error) {
      res.redirect(`${process.env.WEB_URL}/?error=oauth`);
      return;
    }
    res.redirect(url);
  });
};
export const googleCallback: RequestHandler = async (req, res) => {
  const state = req.session.googleState;
  delete req.session.googleState;
  if (
    typeof req.query.state !== "string" ||
    req.query.state !== state ||
    typeof req.query.code !== "string"
  ) {
    res.redirect(`${process.env.WEB_URL}/?error=oauth`);
    return;
  }
  try {
    const user = await authenticateGoogle(req.query.code);
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
    req.session.user = user;
    await new Promise<void>((resolve, reject) =>
      req.session.save((error) => (error ? reject(error) : resolve())),
    );
    res.redirect(process.env.WEB_URL!);
  } catch (error) {
    console.error(
      "Google sign-in failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.redirect(`${process.env.WEB_URL}/?error=oauth`);
  }
};
export const getCurrentUser: RequestHandler = (req, res) => {
  res.json({
    user: req.session.user
      ? {
          ...req.session.user,
          isAdmin: (process.env.ADMIN_EMAILS ?? "")
            .split(",")
            .includes(req.session.user.email),
        }
      : null,
  });
};
export const logout: RequestHandler = (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    res.clearCookie("connect.sid");
    res.sendStatus(204);
  });
};
