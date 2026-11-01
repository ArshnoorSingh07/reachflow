import { useState } from "react";
import {
  Plus,
  Mail,
  ArrowUpRight,
  Loader2,
  ShieldCheck,
  Info,
} from "lucide-react";
import type { Sender } from "../types";
import { api } from "../services/api";
export function Senders({
  senders,
  preview,
  refresh,
  notify,
}: {
  senders: Sender[];
  preview: boolean;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section>
      <div className="section-toolbar">
        <div>
          <h2>
            Sending accounts{" "}
            <span className="count-pill">{senders.length}</span>
          </h2>
          <p>A separate identity for every kind of conversation.</p>
        </div>
        <button className="secondary" onClick={() => setAdding(!adding)}>
          <Plus size={16} />
          Add sender
        </button>
      </div>
      {adding && (
        <form
          className="add-sender-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (preview) {
              notify("Sign in to create a real Ethereal sender.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              await api("/api/senders", {
                method: "POST",
                body: JSON.stringify({ name }),
              });
              setAdding(false);
              setName("");
              refresh();
              notify("Your Ethereal sending account is ready.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <h3>Connect a test sender</h3>
            <p>
              We’ll create a fresh Ethereal mailbox for you. Emails are captured
              for preview and never reach real inboxes.
            </p>
          </div>
          <label>
            Sender name
            <input
              required
              minLength={2}
              maxLength={60}
              placeholder="e.g. Partnerships team"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="inline-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Plus size={16} />
              )}
              Create test sender
            </button>
          </div>
        </form>
      )}
      <div className="sender-grid">
        {senders.map((sender, i) => (
          <article className="sender-card" key={sender.id}>
            <div className="sender-card-top">
              <span className={`sender-monogram tone-${i % 4}`}>
                <Mail size={23} />
              </span>
              <span className="connection-tag">
                <span className="dot" />
                Connected
              </span>
            </div>
            <h3>{sender.name}</h3>
            <p>{sender.email}</p>
            <div className="sender-card-footer">
              <span>
                <ShieldCheck size={14} />
                Ethereal SMTP
              </span>
              <span>Test account</span>
            </div>
          </article>
        ))}
      </div>
      {!senders.length && !adding && (
        <div className="empty panel-empty">
          <div>
            <Mail size={28} />
          </div>
          <h3>Your first sender starts here</h3>
          <p>Create a test mailbox to start scheduling emails.</p>
          <button className="primary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add your first sender
          </button>
        </div>
      )}
      <div className="info-banner">
        <Info size={18} />
        <p>
          Ethereal is a safe testing environment. Sent messages are available as
          previews in the Sent tab.
        </p>
        <a href="https://ethereal.email" target="_blank" rel="noreferrer">
          About Ethereal
          <ArrowUpRight size={14} />
        </a>
      </div>
    </section>
  );
}
