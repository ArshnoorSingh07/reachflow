import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { useCallback, useEffect, useState, lazy, Suspense } from "react";
import {
  Send,
  Clock3,
  Users,
  Plug,
  Plus,
  ArrowUpRight,
  Check,
  AlertCircle,
  Loader2,
  X,
  Star,
  Archive,
  Trash2,
} from "lucide-react";
import { api } from "../services/api";
import type { User, View, Email } from "../types";
import { useWorkspace } from "../hooks/useWorkspace";
const Compose = lazy(() =>
  import("../components/Compose").then((module) => ({
    default: module.Compose,
  })),
);
import { EmailDetail } from "../components/EmailDetail";
import { EmailTable } from "../components/EmailTable";
import { Senders } from "./Senders";
import { Integrations } from "./Integrations";
import { Login } from "./Login";
const labels: Record<View, string> = {
  scheduled: "Scheduled emails",
  sent: "Sent emails",
  senders: "Sending accounts",
  integrations: "Integrations",
  starred: "Starred",
  archived: "Archived",
  trash: "Trash",
};
const icons = {
  scheduled: Clock3,
  sent: Send,
  senders: Users,
  integrations: Plug,
  starred: Star,
  archived: Archive,
  trash: Trash2,
};
function initialView(): View {
  const v = new URLSearchParams(location.search).get("view");
  return v && v in labels ? (v as View) : "scheduled";
}
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(true),
    [view, setView] = useState<View>(initialView),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [sender, setSender] = useState(""),
    [status, setStatus] = useState(""),
    [composing, setComposing] = useState(false),
    [selected, setSelected] = useState<Email | null>(null),
    [toast, setToast] = useState("");
  const expired = useCallback(() => {
    setUser(null);
    setComposing(false);
    setSelected(null);
  }, []);
  useEffect(() => {
    window.addEventListener("reachflow:unauthorized", expired);
    return () => window.removeEventListener("reachflow:unauthorized", expired);
  }, [expired]);
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("reachflow-auth");
    channel.onmessage = (event) => {
      if (event.data === "signed-out") expired();
    };
    return () => channel.close();
  }, [expired]);
  const workspace = useWorkspace(
    user,
    view,
    page,
    query,
    sender,
    status,
    expired,
  );
  const closeCompose = useCallback(() => setComposing(false), []),
    closeDetail = useCallback(() => setSelected(null), []);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("error") === "slack")
      setToast(
        "Slack connection was not completed. Check your app settings and try again.",
      );
    if (params.get("error") === "slack_https")
      setToast(
        "Slack connection requires HTTPS. Open the HTTPS app URL and retry.",
      );
    if (params.get("connected") === "slack")
      setToast("Slack connected. Hourly-limit alerts are now enabled.");
    api<{ user: User | null }>("/api/me")
      .then((x) => setUser(x.user))
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  function change(next: View) {
    setView(next);
    setPage(1);
    setQuery("");
    setStatus("");
    setSender("");
    history.replaceState(null, "", `?view=${next}`);
  }
  const setFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  if (authLoading)
    return (
      <div className="splash">
        <span className="logo">
          <Send size={20} />
        </span>
        <Loader2 className="spin" size={18} />
        Opening your workspace
      </div>
    );
  if (!user) {
    const oauthError = new URLSearchParams(location.search).get("error");
    return (
      <Login
        onAuthenticated={async () => {
          const result = await api<{ user: User }>("/api/me");
          setUser(result.user);
          change("scheduled");
        }}
        googleConfigured={workspace.config.googleConfigured}
        error={
          oauthError === "not_configured"
            ? "Google sign-in is not configured yet. Contact your workspace administrator."
            : oauthError === "oauth"
              ? "Sign-in could not be completed. Check the OAuth configuration and try again."
              : ""
        }
      />
    );
  }
  return (
    <div className="app min-h-screen bg-white">
      <aside className="sidebar" inert={composing || !!selected}>
        <a className="brand" href="/" aria-label="Reachflow home">
          <span className="wordmark">REACHFLOW</span>
        </a>
        <button
          className="sidebar-compose"
          aria-label="Compose New Email"
          onClick={() => setComposing(true)}
        >
          <Plus size={15} />
          <span>Compose</span>
        </button>
        <div className="nav-label">CORE</div>
        <nav aria-label="Workspace navigation">
          {(Object.keys(labels) as View[]).map((v) => {
            const Icon = icons[v];
            return (
              <button
                key={v}
                title={labels[v]}
                aria-label={labels[v]}
                aria-current={view === v ? "page" : undefined}
                className={`nav-item ${view === v ? "active" : ""}`}
                onClick={() => change(v)}
              >
                <Icon size={16} />
                <span className="nav-text">
                  {v === "scheduled"
                    ? "Scheduled"
                    : v === "sent"
                      ? "Sent"
                      : labels[v]}
                </span>
                {(v === "scheduled" || v === "sent") && (
                  <span className="nav-count">{workspace.stats[v]}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          {user.isAdmin && (
            <a
              className="queue-link"
              href="/queues"
              target="_blank"
              rel="noreferrer"
            >
              Queue dashboard <ArrowUpRight size={13} />
            </a>
          )}
        </div>
      </aside>
      <div className="main">
        <div inert={composing || !!selected}>
          <WorkspaceHeader
            user={user}
            title={labels[view]}
            onLogout={async (all) => {
              try {
                await api(all ? "/api/logout-all" : "/api/logout", {
                  method: "POST",
                });
                if ("BroadcastChannel" in window) {
                  const channel = new BroadcastChannel("reachflow-auth");
                  channel.postMessage("signed-out");
                  channel.close();
                }
                expired();
                change("scheduled");
              } catch (error) {
                setToast((error as Error).message);
              }
            }}
          />
        </div>
        <main className="content" inert={composing || !!selected}>
          {workspace.metadataError && (
            <div className="metadata-error" role="alert">
              <AlertCircle size={16} />
              <span>{workspace.metadataError}</span>
              <button onClick={workspace.refresh}>Try again</button>
            </div>
          )}
          {!["senders", "integrations"].includes(view) ? (
            <EmailTable
              view={view}
              rows={workspace.rows}
              total={workspace.total}
              page={page}
              query={query}
              sender={sender}
              status={status}
              senders={workspace.senders}
              loading={workspace.loading}
              error={workspace.error}
              setQuery={setFilter(setQuery)}
              setSender={setFilter(setSender)}
              setStatus={setFilter(setStatus)}
              setPage={setPage}
              refresh={workspace.refresh}
              compose={() => setComposing(true)}
              select={setSelected}
              toggleStar={async (email) => {
                try {
                  await api(`/api/emails/${email.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ starred: !email.starred }),
                  });
                  workspace.refresh();
                } catch (error) {
                  setToast((error as Error).message);
                }
              }}
            />
          ) : (
            <div className="settings-content">
              {view === "senders" ? (
                <Senders
                  senders={workspace.senders}
                  refresh={workspace.refresh}
                  notify={setToast}
                />
              ) : (
                <Integrations
                  slack={workspace.slack}
                  config={workspace.config}
                  changed={workspace.refresh}
                  notify={setToast}
                />
              )}
            </div>
          )}
        </main>
      </div>
      {composing && (
        <Suspense
          fallback={
            <div className="overlay splash">
              <Loader2 className="spin" />
              Opening composer…
            </div>
          }
        >
          <Compose
            senders={workspace.senders}
            config={workspace.config}
            close={closeCompose}
            done={() => {
              setComposing(false);
              change("scheduled");
              workspace.refresh();
              setToast("Emails scheduled successfully.");
            }}
          />
        </Suspense>
      )}
      {selected && (
        <EmailDetail
          email={selected}
          user={user}
          close={closeDetail}
          changed={workspace.refresh}
          notify={setToast}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
