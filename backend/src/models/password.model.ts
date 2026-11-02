import { db } from "../config/database.js";
import { randomUUID } from "node:crypto";
import { profileAvatar } from "../utils/avatar.js";
export async function findPasswordAccount(email: string) {
  return (
    await db.query(
      "SELECT u.*,p.password_hash FROM password_credentials p JOIN users u ON u.id=p.user_id WHERE p.email=$1",
      [email],
    )
  ).rows[0];
}
export async function createPasswordAccount(
  email: string,
  hash: string,
  name?: string,
) {
  const user = {
    id: `local:${randomUUID()}`,
    name: name || email.split("@")[0],
    email,
    avatar: "",
  };
  user.avatar = profileAvatar(user.name);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO users(id,email,name,avatar,auth_provider) VALUES($1,$2,$3,$4,'password')",
      [user.id, email, user.name, user.avatar],
    );
    await client.query(
      "INSERT INTO password_credentials(email,user_id,password_hash) VALUES($1,$2,$3)",
      [email, user.id, hash],
    );
    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
