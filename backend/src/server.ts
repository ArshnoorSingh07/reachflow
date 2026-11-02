import { app, sessionClient } from "./app.js";
import { db } from "./config/database.js";
import { redis } from "./config/redis.js";
import { emails, maintenance } from "./config/queues.js";
const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port);
server.once("listening", () => console.log("API listening on :" + port));
server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `API port ${port} is already in use. Stop the other dev session and run npm run dev again.`
      : error.message,
  );
  process.exit(1);
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;

  const deadline = setTimeout(() => process.exit(1), 30000);
  deadline.unref();
  server.close(async () => {
    try {
      await Promise.all([emails.close(), maintenance.close()]);
      await Promise.all([sessionClient.quit(), db.end(), redis.quit()]);
      clearTimeout(deadline);
      process.exit(0);
    } catch (error) {
      console.error("Shutdown failed", error);
      process.exit(1);
    }
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
