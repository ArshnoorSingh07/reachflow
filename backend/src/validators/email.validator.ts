import {
  sanitizeRichText,
  richTextToPlain,
  decodeAttachment,
} from "../services/message-content.service.js";
import { z } from "zod";
export const scheduleSchema = z
  .object({
    bodyHtml: z.string().max(150000).optional(),
    attachments: z
      .array(
        z.object({
          name: z
            .string()
            .min(1)
            .max(150)
            .regex(/^[^\x00-\x1f\/\\]+$/),
          type: z.enum([
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
            "application/pdf",
            "text/plain",
            "text/csv",
          ]),
          data: z
            .string()
            .max(6990508)
            .regex(
              /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
            ),
        }),
      )
      .max(5)
      .optional(),
    senderId: z.uuid(),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(50000),
    recipients: z.array(z.email()).min(1).max(10000),
    startAt: z.iso.datetime({ offset: true }),
    delayMs: z
      .number()
      .int()
      .min(Number(process.env.MIN_SEND_DELAY_MS ?? 2000))
      .max(3600000),
    hourlyLimit: z
      .number()
      .int()
      .min(1)
      .max(Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? 200)),
  })
  .transform((data) => {
    const total = (data.attachments ?? []).reduce(
      (size, file) => size + decodeAttachment(file).length,
      0,
    );
    if (total > 5 * 1024 * 1024)
      throw Object.assign(new Error("Attachments must total 5 MB or less."), {
        status: 400,
      });
    if (data.bodyHtml) {
      data.bodyHtml = sanitizeRichText(data.bodyHtml);
      data.body = richTextToPlain(data.bodyHtml);
      if (!data.body.trim() || data.body.length > 50000)
        throw Object.assign(
          new Error("Enter a message of 1–50,000 characters."),
          { status: 400 },
        );
    }
    return data;
  });

export type ScheduleInput = z.infer<typeof scheduleSchema>;
