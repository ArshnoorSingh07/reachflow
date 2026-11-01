import { z } from "zod";
import { seal } from "../utils/encryption.js";
import { UserModel } from "../models/user.model.js";
const responseSchema = z.object({
  ok: z.boolean(),
  incoming_webhook: z.object({ url: z.url() }).optional(),
});
export async function connectSlackAccount(userId: string, code: string) {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.API_URL}/api/integrations/slack/callback`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("Slack authorization could not be completed");
  const data = responseSchema.parse(await response.json());
  if (!data.ok || !data.incoming_webhook)
    throw Error("Slack did not return a channel webhook");
  const url = new URL(data.incoming_webhook.url);
  if (url.protocol !== "https:" || url.hostname !== "hooks.slack.com")
    throw Error("Unexpected Slack webhook destination");
  await UserModel.saveSlackConnection(userId, seal(url.toString()));
}
