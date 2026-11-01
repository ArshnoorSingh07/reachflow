import { z } from "zod";
export const scheduleSchema = z.object({
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
});

export type ScheduleInput = z.infer<typeof scheduleSchema>;
