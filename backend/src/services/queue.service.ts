import { db } from "../config/database.js";
import { emails } from "../config/queues.js";
// Keyset pages walk every pending row; the first 2000 delayed jobs cannot starve later batches.
export async function enqueuePending() {
  let cursor: string | null = null;
  while (true) {
    const result: import("pg").QueryResult<{ id: string; scheduled_at: Date }> =
      await db.query(
        "SELECT id,scheduled_at FROM emails WHERE status='scheduled' AND ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 500",
        [cursor],
      );
    const rows = result.rows;
    if (!rows.length) return;
    await emails.addBulk(
      rows.map((e) => ({
        name: "send",
        data: { id: e.id },
        opts: {
          jobId: e.id,
          delay: Math.max(0, new Date(e.scheduled_at).getTime() - Date.now()),
          attempts: 5,
          backoff: { type: "exponential", delay: 5000 },
        },
      })),
    );
    cursor = rows[rows.length - 1].id;
    if (rows.length < 500) return;
  }
}
