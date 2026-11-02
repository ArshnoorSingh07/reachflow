import { db } from "../config/database.js";
export const EmailModel = {
  async stats(userId: string) {
    const { rows } = await db.query(
      `SELECT count(*) FILTER(WHERE status IN ('scheduled','sending'))::int scheduled,count(*) FILTER(WHERE status='sent')::int sent,count(*) FILTER(WHERE status IN ('failed','uncertain'))::int failed,count(*) FILTER(WHERE status='sent' AND sent_at>=date_trunc('day',now()))::int "sentToday" FROM emails WHERE user_id=$1 AND archived_at IS NULL AND deleted_at IS NULL`,
      [userId],
    );
    return rows[0];
  },
  async findById(id: string, userId: string) {
    const email = (
      await db.query(
        "SELECT e.id,e.recipient,e.subject,e.body,e.body_html,e.starred,e.archived_at,e.deleted_at,e.batch_id,e.status,e.scheduled_at,e.sent_at,e.error,e.preview_url,e.delay_ms,e.hourly_limit,s.name sender_name,s.email sender_email FROM emails e JOIN senders s ON s.id=e.sender_id WHERE e.id=$1 AND e.user_id=$2",
        [id, userId],
      )
    ).rows[0];
    if (email)
      email.attachments = (
        await db.query(
          "SELECT id,name,content_type,octet_length(content) size FROM attachments WHERE batch_id=$1 ORDER BY id",
          [email.batch_id],
        )
      ).rows;
    return email;
  },
};
export async function listEmailRecords(
  uid: string,
  view: string,
  page: number,
  ids: string[] | null,
  senderId: string | null = null,
  status: string | null = null,
) {
  const filter =
    "e.user_id=$1 AND (($2='trash' AND e.deleted_at IS NOT NULL) OR ($2='archived' AND e.archived_at IS NOT NULL AND e.deleted_at IS NULL) OR ($2='starred' AND e.starred AND e.deleted_at IS NULL) OR ($2='sent' AND e.status IN ('sent','failed','uncertain') AND e.archived_at IS NULL AND e.deleted_at IS NULL) OR ($2='scheduled' AND e.status IN ('scheduled','sending') AND e.archived_at IS NULL AND e.deleted_at IS NULL)) AND ($3::uuid[] IS NULL OR e.id=ANY($3)) AND ($4::uuid IS NULL OR e.sender_id=$4) AND ($5::text IS NULL OR e.status=$5)";
  const params = [uid, view, ids, senderId, status];
  const total = Number(
    (await db.query(`SELECT count(*) FROM emails e WHERE ${filter}`, params))
      .rows[0].count,
  );
  const { rows } = await db.query(
    `SELECT e.id,e.recipient,e.subject,left(e.body,200) body,e.starred,e.archived_at,e.deleted_at,e.status,e.scheduled_at,e.sent_at,e.preview_url,e.error,e.sender_id,s.name sender_name,s.email sender_email FROM emails e JOIN senders s ON s.id=e.sender_id WHERE ${filter} ORDER BY CASE WHEN $2='sent' THEN COALESCE(e.sent_at,e.scheduled_at) ELSE e.scheduled_at END ${view === "sent" ? "DESC" : "ASC"},e.id LIMIT 12 OFFSET $6`,
    [...params, (page - 1) * 12],
  );
  return { rows, total, page };
}
