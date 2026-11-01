import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
const path = resolve("../.env");
if (existsSync(path)) {
  console.log(".env already exists; left unchanged.");
} else {
  let value = readFileSync(resolve("../.env.example"), "utf8");
  value = value
    .replace(
      "replace-with-at-least-32-random-characters",
      randomBytes(32).toString("hex"),
    )
    .replace("replace-with-64-hex-characters", randomBytes(32).toString("hex"));
  writeFileSync(path, value, { mode: 0o600 });
  console.log(
    "Created .env with secure local session/encryption keys. Add Google and Slack credentials locally.",
  );
}
