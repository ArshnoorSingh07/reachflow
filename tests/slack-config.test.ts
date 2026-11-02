import { test } from "node:test";
import assert from "node:assert/strict";
import { slackRedirectUri } from "../backend/src/services/slack-config.service.js";
test("Slack standard OAuth only builds callbacks for a valid HTTPS app origin", () => {
  assert.equal(slackRedirectUri("http://localhost:4000"), null);
  assert.equal(slackRedirectUri("invalid"), null);
  assert.equal(
    slackRedirectUri("https://example.com/"),
    "https://example.com/api/integrations/slack/callback",
  );
});
