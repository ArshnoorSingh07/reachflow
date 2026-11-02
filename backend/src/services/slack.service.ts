import { slackRedirectUri } from "./slack-config.service.js";
import { z } from "zod";
import { seal } from "../utils/encryption.js";
import { UserModel } from "../models/user.model.js";
const responseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  incoming_webhook: z.object({ url: z.url() }).optional(),
});
export async function connectSlackAccount(userId: string, code: string) {
  const redirectUri = slackRedirectUri();
  if (!redirectUri)
    throw Error("Slack OAuth requires a registered HTTPS app URL.");
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("Slack authorization could not be completed");
  const data = responseSchema.parse(await response.json());
  if (!data.ok || !data.incoming_webhook)
    throw Error(
      `Slack authorization failed: ${data.error ?? "missing_incoming_webhook"}`,
    );
  const url = new URL(data.incoming_webhook.url);
  if (url.protocol !== "https:" || url.hostname !== "hooks.slack.com")
    throw Error("Unexpected Slack webhook destination");
  await UserModel.saveSlackConnection(userId, seal(url.toString()));
}
