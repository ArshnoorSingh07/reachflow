import DOMPurify from "dompurify";
import { ProfileAvatar } from "./ProfileAvatar";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowUpRight,
  Loader2,
  Clock3,
  ArrowLeft,
  Star,
  Archive,
  Trash2,
  RotateCcw,
  Download,
  File,
} from "lucide-react";
import { api } from "../services/api";
import type { Email, User } from "../types";
import { StatusBadge } from "./StatusBadge";
import { useDialog } from "../hooks/useDialog";
export function EmailDetail({
  email,
  close,
  user,
  changed,
  notify,
}: {
  email: Email;
  close: () => void;
  user?: User;
  changed?: () => void;
  notify?: (message: string) => void;
}) {
  const [data, setData] = useState<Email | null>(null),
    [error, setError] = useState(""),
    [acting, setActing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(close, [close]);
  useDialog(ref, dismiss);
  useEffect(() => {
    const controller = new AbortController();
    api<Email>(`/api/emails/${email.id}`, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [email.id]);
  async function action(input: { action?: string; starred?: boolean }) {
    setActing(true);
    setError("");
    try {
      await api(`/api/emails/${email.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      changed?.();
      if (input.action) {
        notify?.(
          input.action === "delete"
            ? "Moved to Trash. Restore it from the Trash section."
            : input.action === "archive"
              ? "Email archived."
              : "Email restored.",
        );
        close();
      } else
        setData((current) =>
          current ? { ...current, starred: input.starred } : current,
        );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setActing(false);
    }
  }
  return (
    <div
      className="overlay page-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="compose detail-panel detail-page"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="email-detail-title"
        ref={ref}
      >
        <div className="editor-topbar flex items-center gap-3">
          <button
            className="icon-button"
            aria-label="Close email details"
            onClick={close}
          >
            <ArrowLeft size={20} />
          </button>
          <h2 id="email-detail-title">{email.subject}</h2>
          <div className="detail-actions">
            <button
              className={`icon-button ${data?.starred ? "starred" : ""}`}
              aria-label={data?.starred ? "Unstar email" : "Star email"}
              disabled={acting || !data}
              onClick={() => void action({ starred: !data?.starred })}
            >
              <Star size={18} />
            </button>
            {data?.deleted_at || data?.archived_at ? (
              <button
                className="icon-button"
                aria-label="Restore email"
                disabled={acting}
                onClick={() => void action({ action: "restore" })}
              >
                <RotateCcw size={18} />
              </button>
            ) : (
              <button
                className="icon-button"
                aria-label="Archive email"
                title="Archive after delivery finishes"
                disabled={
                  acting ||
                  !data ||
                  ["scheduled", "sending"].includes(data.status)
                }
                onClick={() => void action({ action: "archive" })}
              >
                <Archive size={18} />
              </button>
            )}
            {!data?.deleted_at && (
              <button
                className="icon-button"
                aria-label="Move email to Trash"
                title="Delete after delivery finishes"
                disabled={
                  acting ||
                  !data ||
                  ["scheduled", "sending"].includes(data.status)
                }
                onClick={() => void action({ action: "delete" })}
              >
                <Trash2 size={18} />
              </button>
            )}
            {user && <ProfileAvatar user={user} />}
          </div>
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
            </div>

            <div className="message-envelope">
              <span className="sender-initial">
                {(data.sender_name ||
                  data.sender_email ||
                  "S")[0].toUpperCase()}
              </span>
              <div>
                <strong>{data.sender_name || "Sender"}</strong>
                <span>{data.sender_email}</span>
                <small>to {data.recipient}</small>
              </div>
              <time>
                {new Date(data.sent_at ?? data.scheduled_at).toLocaleString(
                  undefined,
                  {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  },
                )}
              </time>
            </div>
            <dl className="message-metadata">
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
            {data.body_html ? (
              <div
                className="message-preview rich-message"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(data.body_html, {
                    FORBID_TAGS: [
                      "img",
                      "iframe",
                      "style",
                      "script",
                      "form",
                      "input",
                    ],
                  }),
                }}
              />
            ) : (
              <div className="message-preview">{data.body}</div>
            )}
            <div className="attachments-grid detail-attachments">
              {data.attachments?.map((file) => (
                <a
                  className="attachment-card"
                  key={file.id}
                  href={`/api/emails/${data.id}/attachments/${file.id}`}
                  download={file.name}
                >
                  {file.content_type.startsWith("image/") ? (
                    <img
                      src={`/api/emails/${data.id}/attachments/${file.id}?inline=1`}
                      alt={file.name}
                    />
                  ) : (
                    <div className="attachment-icon">
                      <File size={30} />
                    </div>
                  )}
                  <strong>{file.name}</strong>
                  <small>
                    {(file.size / 1024).toFixed(1)} KB <Download size={12} />
                  </small>
                </a>
              ))}
            </div>
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
