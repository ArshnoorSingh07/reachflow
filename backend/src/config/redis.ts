import { Redis } from "ioredis";
import { env } from "./env.js";
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
redis.on("error", (error) =>
  console.error("Redis connection error", error.message),
);
