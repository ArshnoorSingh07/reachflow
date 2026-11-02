import { Queue } from "bullmq";
import { redis } from "./redis.js";
export const queuePrefix = process.env.QUEUE_PREFIX ?? "bull";
export const emails = new Queue("emails", {
  connection: redis,
  prefix: queuePrefix,
});
export const maintenance = new Queue("maintenance", {
  connection: redis,
  prefix: queuePrefix,
});
