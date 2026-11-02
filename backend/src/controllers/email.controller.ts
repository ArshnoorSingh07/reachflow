import { db } from "../config/database.js";
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
      ["sent", "archived", "trash", "starred"].includes(String(req.query.view))
        ? String(req.query.view)
        : "scheduled",
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

export const updateEmail: RequestHandler = async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  const input = z
    .object({
      starred: z.boolean().optional(),
      action: z.enum(["archive", "delete", "restore"]).optional(),
    })
    .strict()
    .refine((x) => x.action || x.starred !== undefined)
    .parse(req.body);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const email = (
      await client.query(
        "SELECT * FROM emails WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [id, req.auth!.id],
      )
    ).rows[0];
    if (!email) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Email not found" });
      return;
    }
    if (input.action && ["scheduled", "sending"].includes(email.status)) {
      await client.query("ROLLBACK");
      res
        .status(409)
        .json({
          error:
            "Wait until delivery finishes before archiving or deleting this email.",
        });
      return;
    }
    await client.query(
      "UPDATE emails SET starred=COALESCE($2,starred),archived_at=CASE WHEN $3='archive' THEN now() WHEN $3='restore' THEN NULL ELSE archived_at END,deleted_at=CASE WHEN $3='delete' THEN now() WHEN $3='restore' THEN NULL ELSE deleted_at END,version=version+1 WHERE id=$1",
      [id, input.starred ?? null, input.action ?? null],
    );
    await client.query("COMMIT");
    res.sendStatus(204);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
export const downloadAttachment: RequestHandler = async (req, res) => {
  const emailId = z.uuid().parse(req.params.id),
    attachmentId = z.uuid().parse(req.params.attachmentId);
  const file = (
    await db.query(
      "SELECT a.* FROM attachments a JOIN emails e ON e.batch_id=a.batch_id WHERE e.id=$1 AND e.user_id=$2 AND a.id=$3",
      [emailId, req.auth!.id, attachmentId],
    )
  ).rows[0];
  if (!file) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  res.set("Content-Type", file.content_type);
  res.set("Content-Security-Policy", "default-src 'none'; sandbox");
  res.set(
    "Content-Disposition",
    `${req.query.inline === "1" && file.content_type.startsWith("image/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  );
  res.send(file.content);
};
