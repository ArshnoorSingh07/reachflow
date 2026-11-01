import { db } from "../config/database.js";
export const SenderModel = {
  async findByUser(params: unknown[]) {
    return db.query(
      "SELECT id,name,email FROM senders WHERE user_id=$1 ORDER BY name,id",
      params,
    );
  },
  async create(
    id: string,
    userId: string,
    name: string,
    email: string,
    password: string,
    host: string,
    port: number,
  ) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
        userId,
      ]);
      const count = await client.query(
        "SELECT count(*)::int total FROM senders WHERE user_id=$1",
        [userId],
      );
      if (count.rows[0].total >= 10)
        throw Object.assign(
          Error("A workspace supports up to 10 test senders."),
          { status: 409 },
        );
      await client.query(
        "INSERT INTO senders(id,user_id,name,email,smtp_user,smtp_password,smtp_host,smtp_port) VALUES($1,$2,$3,$4,$4,$5,$6,$7)",
        [id, userId, name, email, password, host, port],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
