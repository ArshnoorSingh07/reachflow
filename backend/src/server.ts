import { app, sessionClient } from "./app.js";
import { db } from "./config/database.js";
import { redis } from "./config/redis.js";
import { emails, maintenance } from "./config/queues.js";
const server = app.listen(Number(process.env.PORT ?? 4000), () =>
  console.log("API listening on :" + (process.env.PORT ?? 4000)),
);
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
