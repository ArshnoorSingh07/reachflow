import { useEffect, useRef, useState, useCallback } from "react";
import { X, ArrowUpRight, Loader2, Mail, Clock3 } from "lucide-react";
import { api } from "../services/api";
import type { Email } from "../types";
import { StatusBadge } from "./StatusBadge";
import { useDialog } from "../hooks/useDialog";
export function EmailDetail({
  email,
  preview,
  close,
}: {
  email: Email;
  preview: boolean;
  close: () => void;
}) {
  const [data, setData] = useState<Email | null>(preview ? email : null),
    [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(close, [close]);
  useDialog(ref, dismiss);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    api<Email>(`/api/emails/${email.id}`, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [email.id, preview]);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="compose detail-panel"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="email-detail-title"
        ref={ref}
      >
        <div className="compose-head">
          <span className="compose-symbol">
            <Mail size={20} />
          </span>
          <button
            className="icon-button"
            aria-label="Close email details"
            onClick={close}
          >
            <X size={20} />
          </button>
          <h2 id="email-detail-title">Message details</h2>
          <p>Everything about this send, in one place.</p>
        </div>
        {error ? (
          <div className="form-error">{error}</div>
        ) : !data ? (
          <div className="empty">
            <Loader2 className="spin" />
            Loading message…
          </div>
        ) : (
          <div className="detail-body">
            <div className="detail-status">
              <StatusBadge status={data.status} />
              <span>{preview ? "Sample message" : "Message record"}</span>
            </div>
            <h2>{data.subject}</h2>
            <dl>
              <div>
                <dt>From</dt>
                <dd>
                  {data.sender_name}
                  <small>{data.sender_email}</small>
                </dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>{data.recipient}</dd>
              </div>
              <div>
                <dt>Scheduled</dt>
                <dd>{new Date(data.scheduled_at).toLocaleString()}</dd>
              </div>
              {data.sent_at && (
                <div>
                  <dt>Delivered</dt>
                  <dd>{new Date(data.sent_at).toLocaleString()}</dd>
                </div>
              )}
            </dl>
            <div className="message-preview">{data.body}</div>
            {data.error && (
              <div className="delivery-warning">
                <strong>
                  {data.status === "uncertain"
                    ? "Review before resending"
                    : "Delivery issue"}
                </strong>
                <p>{data.error}</p>
              </div>
            )}
            <div className="detail-schedule">
              <Clock3 size={16} />
              {(data.delay_ms ?? 2000) / 1000}s between emails ·{" "}
              {data.hourly_limit ?? 200} emails/hour
            </div>
            {data.preview_url && (
              <a
                className="primary"
                href={data.preview_url}
                target="_blank"
                rel="noreferrer"
              >
                Open Ethereal preview
                <ArrowUpRight size={16} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
