import type { RequestHandler } from "express";
import { createHash } from "node:crypto";
import { redis } from "../config/redis.js";
const script = `local count=redis.call('INCR',KEYS[1]);if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end;return {count,redis.call('PTTL',KEYS[1])}`;
export function rateLimit(
  label: string,
  max: number,
  windowMs: number,
  identity: (req: Parameters<RequestHandler>[0]) => string,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const key = createHash("sha256").update(identity(req)).digest("hex");
      const [count, ttl] = (await redis.eval(
        script,
        1,
        `http-limit:${label}:${key}`,
        windowMs,
      )) as number[];
      if (count > max) {
        res.set("Retry-After", String(Math.max(1, Math.ceil(ttl / 1000))));
        res
          .status(429)
          .json({
            error: "Too many requests. Please wait before trying again.",
          });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
