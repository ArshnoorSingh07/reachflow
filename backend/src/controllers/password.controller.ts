import type { RequestHandler } from "express";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../services/password.service.js";
import {
  createPasswordAccount,
  findPasswordAccount,
} from "../models/password.model.js";
import { establishSession } from "../services/session.service.js";
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
});
const dummy = await hashPassword("dummy-password-for-constant-work");
export const passwordAuth: RequestHandler = async (req, res) => {
  if (req.get("origin") !== process.env.WEB_URL) {
    res.status(403).json({ error: "Invalid sign-in origin." });
    return;
  }
  const input = credentials.parse(req.body);
  if (req.path.endsWith("/register")) {
    if (input.password.length < 12) {
      res
        .status(400)
        .json({ error: "Use a password of at least 12 characters." });
      return;
    }
    try {
      const user = await createPasswordAccount(
        input.email,
        await hashPassword(input.password),
        [input.firstName, input.lastName].filter(Boolean).join(" ") ||
          undefined,
      );
      await establishSession(req, user, 0);
      res.status(201).json({ ok: true });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        res.status(409).json({
          error: "Unable to create this account. Try signing in instead.",
        });
        return;
      }
      throw error;
    }
    return;
  }
  const account = await findPasswordAccount(input.email);
  const valid = await verifyPassword(
    input.password,
    account?.password_hash ?? dummy,
  );
  if (!valid || !account || account.disabled_at) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }
  await establishSession(
    req,
    {
      id: account.id,
      email: account.email,
      name: account.name,
      avatar: account.avatar,
    },
    account.session_version,
  );
  res.json({ ok: true });
};
