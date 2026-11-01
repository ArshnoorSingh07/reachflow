import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Loader2,
  Unplug,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import type { AppConfig, User } from "../types";
import { api } from "../services/api";
export function Integrations({
  user,
  slack,
  preview,
  config,
  changed,
  notify,
}: {
  user: User;
  slack: boolean;
  preview: boolean;
  config: AppConfig;
  changed: () => void;
  notify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <section>
      <div className="section-toolbar">
        <div>
          <h2>Bring your tools together</h2>
          <p>Fewer tabs. Better visibility. A team that stays in sync.</p>
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
            A heads-up, right when you need it. Get a channel notification when
            a sender reaches its hourly limit.
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
                if (preview) {
                  notify(
                    "Slack connections are available after Google sign-in.",
                  );
                  return;
                }
                if (!slack) {
                  if (!config.slackConfigured) {
                    notify(
                      "Add your Slack client ID and secret to .env, then restart the API. See SETUP.md.",
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
        <article className="integration-card">
          <div className="integration-card-top">
            <div className="app-symbol google-symbol">G</div>
            <span className="connection-tag">
              <span className="dot" />
              {preview ? "Sample account" : "Connected"}
            </span>
          </div>
          <h3>Google</h3>
          <p>
            Your workspace, securely yours. Sign in with your Google account
            without another password to remember.
          </p>
          <div className="connected-person">
            {user.avatar ? (
              <img src={user.avatar} alt="" />
            ) : (
              <span>{user.name[0]}</span>
            )}
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <div className="integration-feature">
            <ShieldCheck size={15} />
            Identity verified with Google
          </div>
          <div className="integration-card-action">
            <span className="muted-text">
              Managed through your workspace sign-in.
            </span>
          </div>
        </article>
      </div>
      <div className="integration-security">
        <ShieldCheck size={20} />
        <div>
          <h3>Your connections are protected</h3>
          <p>
            Slack webhook credentials are encrypted at rest. Disconnect at any
            time to stop notifications.
          </p>
        </div>
        <a
          href="https://myaccount.google.com/connections"
          target="_blank"
          rel="noreferrer"
          aria-label="Manage Google account connections"
        >
          <ExternalLink size={16} />
        </a>
      </div>
    </section>
  );
}
