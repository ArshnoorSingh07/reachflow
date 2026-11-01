import { Queue } from "bullmq";
import { redis } from "./redis.js";
export const emails = new Queue("emails", { connection: redis });
export const maintenance = new Queue("maintenance", { connection: redis });
