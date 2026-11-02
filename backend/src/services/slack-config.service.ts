/** Standard Slack web-app OAuth requires the same registered HTTPS callback at both steps. */
export function slackRedirectUri(apiUrl = process.env.API_URL): string | null {
  try {
    const url = new URL(apiUrl ?? "");
    if (url.protocol !== "https:") return null;
    return new URL("/api/integrations/slack/callback", url.origin).toString();
  } catch {
    return null;
  }
}
