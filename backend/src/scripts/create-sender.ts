import { db } from "../config/database.js";
import { SenderService } from "../services/sender.service.js";
const email = process.argv[2];
if (!email)
  throw Error("Usage: npm run sender -w backend -- your-google-email");
try {
  const { rows } = await db.query("SELECT id FROM users WHERE email=$1", [
    email,
  ]);
  if (!rows[0]) throw Error("Log in with Google first");
  await SenderService.create(rows[0].id, "Ethereal sender");
  console.log("Ethereal sender added for", email);
} finally {
  await db.end();
}
