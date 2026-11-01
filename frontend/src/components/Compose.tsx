import { useCallback, useRef, useState } from "react";
import {
  Send,
  X,
  UploadCloud,
  Clock3,
  Loader2,
  FileText,
  Check,
  ArrowRight,
  Users,
  Info,
  Mail,
} from "lucide-react";
import { api } from "../services/api";
import type { AppConfig, Sender } from "../types";
import { parseLeads } from "../utils/leads";
import { useDialog } from "../hooks/useDialog";
export function Compose({
  senders,
  config,
  preview,
  close,
  done,
}: {
  senders: Sender[];
  config: AppConfig;
  preview: boolean;
  close: () => void;
  done: () => void;
}) {
  const [subject, setSubject] = useState(""),
    [body, setBody] = useState(""),
    [sender, setSender] = useState(senders[0]?.id ?? ""),
    [recipients, setRecipients] = useState<string[]>([]),
    [fileName, setFileName] = useState(""),
    [ignored, setIgnored] = useState(0),
    [duplicates, setDuplicates] = useState(0),
    [dragging, setDragging] = useState(false),
    [start, setStart] = useState(() => {
      const d = new Date(Date.now() + 300000);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    }),
    [delay, setDelay] = useState(config.minDelayMs / 1000),
    [limit, setLimit] = useState(config.maxHourlyLimit),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID()),
    panel = useRef<HTMLDivElement>(null),
    dismiss = useCallback(close, [close]);
  useDialog(panel, dismiss, busy);
  function resetLeads() {
    setRecipients([]);
    setFileName("");
    setIgnored(0);
    setDuplicates(0);
    key.current = crypto.randomUUID();
  }
  async function upload(file: File) {
    resetLeads();
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setError("Choose a CSV or text file.");
      return;
    }
    if (file.size > 2000000) {
      setError("Choose a file smaller than 2 MB.");
      return;
    }
    try {
      const parsed = parseLeads(await file.text());
      if (!parsed.emails.length) {
        setError(
          "No valid email addresses were found. Check your file and try again.",
        );
        return;
      }
      if (parsed.emails.length > config.maxRecipients) {
        setError(
          `A batch supports up to ${config.maxRecipients.toLocaleString()} recipients. Split this file into smaller batches.`,
        );
        return;
      }
      setRecipients(parsed.emails);
      setIgnored(parsed.ignored);
      setDuplicates(parsed.duplicates);
      setFileName(file.name);
      setError("");
    } catch {
      setError(
        "We couldn’t read that file. Please try another CSV or text file.",
      );
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <div
        className="compose"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="compose-title"
        ref={panel}
      >
        <div className="compose-head">
          <span className="compose-symbol">
            <Send size={20} />
          </span>
          <button
            className="icon-button"
            aria-label="Close compose"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
          <div className="eyebrow">MAKE YOUR NEXT CONNECTION</div>
          <h2 id="compose-title">A thoughtful hello starts here.</h2>
          <p>Your message. Your audience. The perfect moment.</p>
        </div>
        <form
          onChange={() => {
            if (!busy) key.current = crypto.randomUUID();
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (preview) {
              setError(
                "You’re in a sample workspace. Sign in with Google to schedule real emails.",
              );
              return;
            }
            if (!recipients.length) {
              setError(
                "Upload a lead file with at least one valid email address.",
              );
              return;
            }
            if (new Date(start).getTime() < Date.now() - 60000) {
              setError("Choose a start time in the future.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              await api("/api/schedule", {
                method: "POST",
                headers: { "idempotency-key": key.current },
                body: JSON.stringify({
                  senderId: sender,
                  subject,
                  body,
                  recipients,
                  startAt: new Date(start).toISOString(),
                  delayMs: Math.round(delay * 1000),
                  hourlyLimit: limit,
                }),
              });
              done();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="compose-fields">
            <div className="form-section-title">
              <span>01</span>
              <div>
                <h3>Choose your audience</h3>
                <p>The people behind your next conversation.</p>
              </div>
            </div>
            <label>
              Send from
              <select
                required
                value={sender}
                onChange={(e) => setSender(e.target.value)}
              >
                <option value="" disabled>
                  Select a sending account
                </option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.email}
                  </option>
                ))}
              </select>
            </label>
            {!senders.length && (
              <div className="inline-info">
                <Info size={16} />
                <span>
                  Add a test sender on the Sending accounts page first.
                </span>
              </div>
            )}
            <div className="recipient-upload">
              <span className="field-label">
                Lead file<span>CSV or TXT · 2 MB max</span>
              </span>
              {fileName ? (
                <div className="uploaded-file">
                  <span className="file-icon">
                    <FileText size={23} />
                  </span>
                  <div>
                    <strong>{fileName}</strong>
                    <small>
                      <Check size={12} />
                      {recipients.length.toLocaleString()} unique recipients
                    </small>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove lead file"
                    onClick={resetLeads}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label
                  className={`upload ${dragging ? "dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (e.dataTransfer.files[0])
                      void upload(e.dataTransfer.files[0]);
                  }}
                >
                  <span className="upload-symbol">
                    <UploadCloud size={22} />
                  </span>
                  <strong>
                    <span>Click to upload</span> or drag and drop
                  </strong>
                  <span>One email per line, or a CSV with an email column</span>
                  <input
                    type="file"
                    aria-label="Upload lead file"
                    accept=".csv,.txt"
                    onChange={(e) => {
                      if (e.target.files?.[0]) void upload(e.target.files[0]);
                    }}
                  />
                </label>
              )}
              {fileName && (
                <>
                  <div className="lead-chips">
                    {recipients.slice(0, 2).map((email) => (
                      <span key={email}>{email}</span>
                    ))}
                    {recipients.length > 2 && (
                      <span>+{recipients.length - 2} more</span>
                    )}
                  </div>
                  <p className="file-notes">
                    {duplicates > 0
                      ? `${duplicates} duplicate${duplicates === 1 ? "" : "s"} removed. `
                      : ""}
                    {ignored > 0
                      ? `${ignored} non-email field${ignored === 1 ? "" : "s"} ignored.`
                      : ""}
                  </p>
                </>
              )}
            </div>
            <div className="form-section-title">
              <span>02</span>
              <div>
                <h3>Make it worth opening</h3>
                <p>A good conversation begins with a good message.</p>
              </div>
            </div>
            <label>
              Subject
              <input
                required
                maxLength={200}
                placeholder="A subject worth opening"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <label>
              Message
              <textarea
                aria-label="Message"
                required
                maxLength={50000}
                rows={7}
                placeholder={
                  "Hi there,\n\nI had an idea I thought you’d love…\n\nBest,\nYour name"
                }
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <span className="input-caption">
                Plain text keeps your message simple and personal.
                <span>{body.length.toLocaleString()} / 50,000</span>
              </span>
            </label>
            <div className="form-section-title">
              <span>03</span>
              <div>
                <h3>Find the right moment</h3>
                <p>Give each email a little breathing room.</p>
              </div>
            </div>
            <label>
              Start sending
              <input
                type="datetime-local"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <span className="input-caption">
                Your timezone:{" "}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </label>
            <div className="field-pair">
              <label>
                Delay between emails
                <div className="unit-input">
                  <input
                    required
                    type="number"
                    step="0.1"
                    min={config.minDelayMs / 1000}
                    max={3600}
                    value={delay}
                    onChange={(e) => setDelay(Number(e.target.value))}
                  />
                  <span>seconds</span>
                </div>
                <span className="input-caption">
                  Minimum {config.minDelayMs / 1000}s between sends
                </span>
              </label>
              <label>
                Hourly limit
                <div className="unit-input">
                  <input
                    required
                    type="number"
                    min={1}
                    max={config.maxHourlyLimit}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                  />
                  <span>/ sender</span>
                </div>
                <span className="input-caption">
                  Up to {config.maxHourlyLimit.toLocaleString()} per hour
                </span>
              </label>
            </div>
            <div className="schedule-summary">
              <span>
                <Clock3 size={17} />
                <strong>Your sending plan</strong>
              </span>
              <p>
                <strong>{recipients.length.toLocaleString()} emails</strong> ·{" "}
                {delay}s apart · up to {limit}/hour
              </p>
              <small>
                Limits are shared across this sender’s campaigns. Emails over
                the limit wait for the next hour.
              </small>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
          </fieldset>
          <div className="compose-foot">
            <span>
              <Users size={15} />
              {recipients.length.toLocaleString()} recipients
            </span>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
            <button className="primary" disabled={busy || !senders.length}>
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Clock3 size={16} />
              )}
              Schedule emails
              <ArrowRight size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
