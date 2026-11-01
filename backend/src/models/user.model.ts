import { db } from "../config/database.js";
export type Identity = {
  id: string;
  email: string;
  name: string;
  avatar: string;
};
export const UserModel = {
  async upsertGoogleUser(user: Identity) {
    await db.query(
      "INSERT INTO users(id,email,name,avatar) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET email=$2,name=$3,avatar=$4",
      [user.id, user.email, user.name, user.avatar],
    );
  },
  async getSlackConnection(userId: string): Promise<string | null> {
    return (
      (
        await db.query<{ slack_webhook: string | null }>(
          "SELECT slack_webhook FROM users WHERE id=$1",
          [userId],
        )
      ).rows[0]?.slack_webhook ?? null
    );
  },
  async clearSlackConnection(userId: string) {
    await db.query("UPDATE users SET slack_webhook=NULL WHERE id=$1", [userId]);
  },
  async saveSlackConnection(userId: string, webhook: string) {
    await db.query("UPDATE users SET slack_webhook=$1 WHERE id=$2", [
      webhook,
      userId,
    ]);
  },
};
