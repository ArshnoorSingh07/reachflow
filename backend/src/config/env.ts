import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  ELASTIC_URL: z.url(),
  API_URL: z.url().default("http://localhost:4000"),
  WEB_URL: z.url().default("http://localhost:5173"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().regex(/^[a-f\d]{64}$/i),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(5),
  MIN_SEND_DELAY_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(3600000)
    .default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .default(200),
});
export const env = schema.parse(process.env);
