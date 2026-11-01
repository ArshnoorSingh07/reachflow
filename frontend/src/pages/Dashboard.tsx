import { useCallback, useEffect, useState } from "react";
import {
  Send,
  Clock3,
  Users,
  Plug,
  Plus,
  ChevronDown,
  LogOut,
  ArrowUpRight,
  Zap,
  Layers3,
  Check,
  AlertCircle,
  Loader2,
  X,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { api } from "../services/api";
import type { User, View, Email } from "../types";
import { useWorkspace } from "../hooks/useWorkspace";
import { Compose } from "../components/Compose";
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
};
const icons = {
  scheduled: Clock3,
  sent: Send,
  senders: Users,
  integrations: Plug,
};
function initialView(): View {
  const v = new URLSearchParams(location.search).get("view");
  return v && v in labels ? (v as View) : "scheduled";
}
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(true),
    [preview, setPreview] = useState(false),
    [view, setView] = useState<View>(initialView),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [sender, setSender] = useState(""),
    [status, setStatus] = useState(""),
    [composing, setComposing] = useState(false),
    [selected, setSelected] = useState<Email | null>(null),
    [toast, setToast] = useState(""),
    [loggingOut, setLoggingOut] = useState(false);
  const expired = useCallback(() => setUser(null), []);
  const workspace = useWorkspace(
    user,
    preview,
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
        error={
          oauthError === "oauth"
            ? "Sign-in could not be completed. Check the OAuth configuration and try again."
            : ""
        }
        preview={() => {
          setPreview(true);
          setUser({
            name: "Alex Morgan",
            email: "alex@example.com",
            avatar: "",
          });
        }}
      />
    );
  }
  const title = {
    scheduled: "Every email. Right on time.",
    sent: "Connections, delivered.",
    senders: "The people behind your sends.",
    integrations: "Better, together.",
  }[view];
  const subtitle = {
    scheduled: "Plan your outreach and let us take care of the timing.",
    sent: "A clear view of every message that left your workspace.",
    senders: "Give every conversation a familiar name and a trusted sender.",
    integrations: "Your favorite tools, connected to your outreach flow.",
  }[view];
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Reachflow home">
          <span className="logo">
            <Send size={21} />
          </span>
          <span>
            reachflow<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace">
          <div className="workspace-icon">{user.name[0]}</div>
          <div>
            <strong>My workspace</strong>
            <small>Personal workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
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
                <Icon size={18} />
                <span className="nav-text">{labels[v]}</span>
                {v === "scheduled" && (
                  <span className="nav-count">{workspace.stats.scheduled}</span>
                )}
                {v === "integrations" && <span className="new-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="tip">
            <span className="tip-icon">
              <Zap size={19} />
            </span>
            <strong>
              A little planning.
              <br />A lot more possibility.
            </strong>
            <p>Make room for the conversations that matter.</p>
            <button
              className="queue-link"
              onClick={() => {
                if (preview || !user.isAdmin) {
                  setToast(
                    "Queue controls are available to workspace operators listed in ADMIN_EMAILS.",
                  );
                  return;
                }
                window.open("/queues", "_blank", "noopener,noreferrer");
              }}
            >
              Queue dashboard
              <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="sidebar-foot">
            <span className="dot" />
            {preview ? "Sample workspace" : "Your email workspace"}
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main">
        <header>
          <div className="breadcrumb">
            Workspace<span>/</span>
            <strong>{labels[view]}</strong>
          </div>
          <div className="header-right">
            {preview && <span className="preview-tag">Preview mode</span>}
            <span className="header-divider" />
            <div className="user-info">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            {user.avatar ? (
              <img className="avatar" src={user.avatar} alt="Your profile" />
            ) : (
              <div className="avatar">
                {user.name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            )}
            <button
              className="icon-button"
              aria-label="Log out"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  if (!preview) await api("/api/logout", { method: "POST" });
                  setUser(null);
                  setPreview(false);
                  change("scheduled");
                } catch (e) {
                  setToast((e as Error).message);
                } finally {
                  setLoggingOut(false);
                }
              }}
            >
              {loggingOut ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <LogOut size={17} />
              )}
            </button>
          </div>
        </header>
        <main className="content" inert={composing || !!selected}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-line" />
                YOUR OUTREACH, IN FLOW
              </div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <button
              className="primary compose-button"
              onClick={() => setComposing(true)}
            >
              <Plus size={17} />
              Compose new email
            </button>
          </div>
          {preview && (
            <div className="preview-banner">
              <span>
                <Layers3 size={15} />
                You’re exploring a sample workspace. No emails will be sent.
              </span>
              <a href="/auth/google">
                Start your workspace
                <ArrowRight size={14} />
              </a>
            </div>
          )}
          {workspace.metadataError && (
            <div className="metadata-error" role="alert">
              <AlertCircle size={16} />
              <span>{workspace.metadataError}</span>
              <button onClick={workspace.refresh}>Try again</button>
            </div>
          )}
          <div className="stats-grid">
            {[
              {
                label: "Scheduled emails",
                value: workspace.stats.scheduled,
                icon: Clock3,
                note: "Ready for their moment",
                color: "purple",
              },
              {
                label: "Emails delivered",
                value: workspace.stats.sent,
                icon: Send,
                note: `${workspace.stats.sentToday} delivered today`,
                color: "green",
              },
              {
                label: "Needs attention",
                value: workspace.stats.failed,
                icon: AlertCircle,
                note: "Failed or uncertain deliveries",
                color: "orange",
              },
            ].map((s) => (
              <div className="stat-card" key={s.label}>
                <div className="stat-top">
                  <span>{s.label}</span>
                  <span className={`stat-icon ${s.color}`}>
                    <s.icon size={18} />
                  </span>
                </div>
                <strong className="stat-number">
                  {Number(s.value).toLocaleString()}
                </strong>
                <div className="stat-note">
                  <span className={`stat-note-dot ${s.color}`} />
                  {s.note}
                </div>
                <s.icon
                  className={`stat-watermark ${s.color}`}
                  size={65}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
          {view === "scheduled" || view === "sent" ? (
            <EmailTable
              view={view}
              stats={workspace.stats}
              rows={workspace.rows}
              total={workspace.total}
              page={page}
              query={query}
              sender={sender}
              status={status}
              senders={workspace.senders}
              loading={workspace.loading}
              error={workspace.error}
              preview={preview}
              change={change}
              setQuery={setFilter(setQuery)}
              setSender={setFilter(setSender)}
              setStatus={setFilter(setStatus)}
              setPage={setPage}
              refresh={workspace.refresh}
              compose={() => setComposing(true)}
              select={setSelected}
            />
          ) : view === "senders" ? (
            <Senders
              senders={workspace.senders}
              preview={preview}
              refresh={workspace.refresh}
              notify={setToast}
            />
          ) : (
            <Integrations
              user={user}
              slack={workspace.slack}
              config={workspace.config}
              preview={preview}
              changed={workspace.refresh}
              notify={setToast}
            />
          )}
          <div className="below-panel">
            <span>
              <ShieldCheck size={14} />
              {preview
                ? "Sample data for design preview"
                : "Persistent scheduling. Thoughtful delivery."}
            </span>
            <span>
              Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
          </div>
          <div className="bottom-note">
            <span className="note-icon">
              <Zap size={18} />
            </span>
            <div>
              <strong>Set it. Send it. Stay in your flow.</strong>
              <p>Your emails wait for their moment, even when you’re away.</p>
            </div>
            <span className="note-decoration">↗</span>
          </div>
        </main>
        <footer>
          Made for meaningful connections.
          <span>Reachflow © {new Date().getFullYear()}</span>
        </footer>
      </div>
      {composing && (
        <Compose
          senders={workspace.senders}
          config={workspace.config}
          preview={preview}
          close={closeCompose}
          done={() => {
            setComposing(false);
            workspace.refresh();
            setToast("Emails scheduled. Your outreach is in motion.");
          }}
        />
      )}
      {selected && (
        <EmailDetail email={selected} preview={preview} close={closeDetail} />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
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
