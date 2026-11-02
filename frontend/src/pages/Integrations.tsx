import { useState } from "react";
import { ArrowUpRight, Check, Loader2, Unplug } from "lucide-react";
import type { AppConfig } from "../types";
import { api } from "../services/api";
export function Integrations({
  slack,
  config,
  changed,
  notify,
}: {
  slack: boolean;
  config: AppConfig;
  changed: () => void;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <section>
      <div className="section-toolbar">
        <div>
          <h2>Integrations</h2>
          <p>Manage your Slack notifications.</p>
        </div>
      </div>
      <div className="integration-grid">
        <article className="integration-card">
          <div className="integration-card-top">
            <div className="app-symbol slack-symbol">
              <span>#</span>
            </div>
            <span className={slack ? "connection-tag" : "not-connected"}>
              {slack ? (
                <>
                  <span className="dot" />
                  Connected
                </>
              ) : (
                "Not connected"
              )}
            </span>
          </div>
          <h3>Slack</h3>
          <p>
            Get a channel notification when a sender reaches its hourly limit.
          </p>
          <div className="integration-feature">
            <Check size={15} />
            Live rate-limit alerts
          </div>
          <div className="integration-feature">
            <Check size={15} />
            Choose your channel during connection
          </div>
          <div className="integration-card-action">
            <button
              className={slack ? "secondary" : "primary"}
              disabled={busy}
              onClick={async () => {
                if (!slack) {
                  if (!config.slackConfigured) {
                    notify(
                      "Slack is not configured. Contact your workspace administrator.",
                    );
                    return;
                  }
                  if (config.slackOAuthReady === false) {
                    notify(
                      "Slack connection requires the HTTPS app URL. Open the HTTPS deployment and connect Slack there.",
                    );
                    return;
                  }
                  location.href = "/api/integrations/slack/connect";
                  return;
                }
                setBusy(true);
                try {
                  await api("/api/integrations/slack", { method: "DELETE" });
                  changed();
                  notify("Slack disconnected. You can reconnect at any time.");
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : slack ? (
                <Unplug size={16} />
              ) : (
                <ArrowUpRight size={16} />
              )}{" "}
              {slack ? "Disconnect Slack" : "Connect Slack"}
            </button>
            <small>
              {slack
                ? "Notifications are enabled for this workspace."
                : "Secure connection through Slack OAuth."}
            </small>
          </div>
        </article>
      </div>
    </section>
  );
}
