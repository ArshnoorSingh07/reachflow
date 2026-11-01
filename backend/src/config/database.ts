import pg from "pg";
import { env } from "./env.js";
export const db = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.WORKER_CONCURRENCY + 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});
db.on("error", (error) =>
  console.error("PostgreSQL connection error", error.message),
);
