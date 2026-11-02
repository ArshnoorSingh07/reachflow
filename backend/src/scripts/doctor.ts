import "../config/env.js";
import { searchFetch } from "../config/search.js";
import { db } from "../config/database.js";
import { redis } from "../config/redis.js";
let failed = false;
for (const [name, check] of [
  ["PostgreSQL", () => db.query("SELECT 1")],
  [
    "Redis",
    () =>
      Promise.race([
        redis.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(Error("Connection timeout")), 5000),
        ),
      ]),
  ],
  [
    "Elasticsearch",
    async () => {
      const response = await searchFetch("_cluster/health", {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
    },
  ],
] as const) {
  try {
    await check();
    console.log(`✓ ${name} reachable`);
  } catch {
    failed = true;
    console.log(`✗ ${name} unavailable — start Docker services and check .env`);
  }
}
console.log(
  `${process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "✓" : "○"} Google OAuth ${process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "configured" : "needs client ID and secret"}`,
);
console.log(
  `${process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET ? "✓" : "○"} Slack OAuth ${process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET ? "configured" : "needs client ID and secret"}`,
);
redis.disconnect();
await db.end();
process.exitCode = failed ? 1 : 0;
