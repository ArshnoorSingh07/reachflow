import { emailIndex, searchFetch } from "../config/search.js";
import { db } from "../config/database.js";
export async function indexEmail(id: string) {
  const { rows } = await db.query(
    "SELECT id,user_id,recipient,subject,body,status,scheduled_at,sent_at,version FROM emails WHERE id=$1",
    [id],
  );
  if (!rows[0]) return;
  const r = await searchFetch(
    `${emailIndex}/_doc/${id}?version=${rows[0].version}&version_type=external_gte`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rows[0]),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (r.status === 409) return;
  if (!r.ok) throw Error(`Search indexing failed: ${r.status}`);
  await db.query(
    "UPDATE emails SET indexed_version=version WHERE id=$1 AND version=$2",
    [id, rows[0].version ?? -1],
  );
}
