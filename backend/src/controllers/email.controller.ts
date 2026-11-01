import type { RequestHandler } from "express";
import { z } from "zod";
import { scheduleSchema } from "../validators/email.validator.js";
import { EmailService } from "../services/email.service.js";
import { EmailModel } from "../models/email.model.js";
export const scheduleEmails: RequestHandler = async (req, res) => {
  const data = scheduleSchema.parse(req.body);
  const key = z.string().min(8).max(128).parse(req.get("idempotency-key"));
  res
    .status(202)
    .json(await EmailService.schedule(req.session.user!.id, data, key));
};
export const listEmails: RequestHandler = async (req, res) => {
  const page = z.coerce
    .number()
    .int()
    .positive()
    .max(100000)
    .default(1)
    .parse(req.query.page);
  const senderId =
    z
      .uuid()
      .optional()
      .parse(req.query.sender || undefined) ?? null;
  const status =
    z
      .enum(["scheduled", "sending", "sent", "failed", "uncertain"])
      .optional()
      .parse(req.query.status || undefined) ?? null;
  res.json(
    await EmailService.list(
      req.session.user!.id,
      req.query.view === "sent" ? "sent" : "scheduled",
      page,
      String(req.query.q ?? "").slice(0, 200),
      senderId,
      status,
    ),
  );
};
export const getStats: RequestHandler = async (req, res) => {
  res.json(await EmailModel.stats(req.session.user!.id));
};
export const getEmail: RequestHandler = async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const email = await EmailModel.findById(id, req.session.user!.id);
  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }
  res.json(email);
};
