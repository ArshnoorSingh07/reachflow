import { test } from "node:test";
import assert from "node:assert/strict";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { admissionScript } from "../backend/src/services/rate-limit.service.js";
test(
  "real Redis Lua: concurrent workers respect spacing and hourly quota",
  { skip: !process.env.TEST_REDIS_URL },
  async () => {
    const redis = new Redis(process.env.TEST_REDIS_URL!);
    const key = `test:${randomUUID()}`;
    try {
      const results = await Promise.all(
        Array.from(
          { length: 30 },
          () =>
            redis.eval(admissionScript, 1, key, 2, 2000) as Promise<number[]>,
        ),
      );
      assert.equal(results.filter((r) => r[0] === 0).length, 1);
      assert.equal(await redis.hget(key, "count"), "1");
      await redis.hset(key, "next", 0);
      const hit = (await redis.eval(
        admissionScript,
        1,
        key,
        2,
        2000,
      )) as number[];
      assert.equal(hit[1], 1);
      const blocked = (await redis.eval(
        admissionScript,
        1,
        key,
        2,
        2000,
      )) as number[];
      assert.ok(blocked[0] > Date.now());
      assert.equal(await redis.hget(key, "count"), "2");
    } finally {
      await redis.del(key);
      await redis.quit();
    }
  },
);
