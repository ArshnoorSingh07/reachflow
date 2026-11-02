import { establishSession } from "../services/session.service.js";
import type { RequestHandler } from "express";
import { randomBytes } from "node:crypto";
import { CodeChallengeMethod } from "google-auth-library";
import { google } from "../config/oauth.js";
import { redis } from "../config/redis.js";
import { authenticateGoogle } from "../services/auth.service.js";
import { equalToken } from "../services/access-policy.service.js";
import { revokeSessions } from "../models/user.model.js";
const destination = () => `${process.env.WEB_URL}/?error=oauth`;
export const googleLogin: RequestHandler = async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    res.redirect(`${process.env.WEB_URL}/?error=not_configured`);
    return;
  }
  const state = randomBytes(32).toString("hex"),
    nonce = randomBytes(32).toString("hex"),
    { codeVerifier, codeChallenge } = await google.generateCodeVerifierAsync();
  await redis.set(
    `oauth:google:${req.sessionID}`,
    JSON.stringify({ state, nonce, codeVerifier }),
    "EX",
    600,
  );
  req.session.csrfToken ??= randomBytes(32).toString("hex");
  await new Promise<void>((resolve, reject) =>
    req.session.save((error) => (error ? reject(error) : resolve())),
  );
  res.redirect(
    google.generateAuthUrl({
      scope: ["openid", "email", "profile"],
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: "select_account",
    }),
  );
};
export const googleCallback: RequestHandler = async (req, res) => {
  try {
    const raw = await redis.getdel(`oauth:google:${req.sessionID}`);
    if (!raw || typeof req.query.code !== "string")
      throw Error("Expired authorization request");
    const challenge = JSON.parse(raw) as {
      state: string;
      nonce: string;
      codeVerifier: string;
    };
    if (!equalToken(challenge.state, req.query.state))
      throw Error("Invalid OAuth state");
    const { user, sessionVersion } = await authenticateGoogle(
      req.query.code,
      challenge.codeVerifier,
      challenge.nonce,
    );
    await establishSession(req, user, sessionVersion);
    res.redirect(process.env.WEB_URL!);
  } catch (error) {
    console.error(
      "Google sign-in failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.redirect(destination());
  }
};
export const getCurrentUser: RequestHandler = (req, res) => {
  res.json({
    user: req.auth
      ? { ...req.auth, isAdmin: req.auth.role === "operator" }
      : null,
    csrfToken: req.auth ? req.session.csrfToken : null,
    session: req.auth
      ? {
          authenticatedAt: req.session.authenticatedAt,
          expiresAt: req.session.authenticatedAt! + 86400000,
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
    res.clearCookie("reachflow.sid");
    res.sendStatus(204);
  });
};
export const logoutAll: RequestHandler = async (req, res, next) => {
  await revokeSessions(req.auth!.id);
  logout(req, res, next);
};
