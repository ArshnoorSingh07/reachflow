import { RichTextEditor } from "./RichTextEditor";
import { useCallback, useRef, useState } from "react";
import {
  X,
  UploadCloud,
  Clock3,
  Loader2,
  FileText,
  Info,
  ArrowLeft,
  Paperclip,
  File,
} from "lucide-react";
import { api } from "../services/api";
import type { AppConfig, Sender, AttachmentInput } from "../types";
import { parseLeads } from "../utils/leads";
import { useDialog } from "../hooks/useDialog";
export function Compose({
  senders,
  config,
  close,
  done,
}: {
  senders: Sender[];
  config: AppConfig;
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
    [busy, setBusy] = useState(false),
    [scheduleOpen, setScheduleOpen] = useState(false),
    [recipientInput, setRecipientInput] = useState("");
  const [bodyHtml, setBodyHtml] = useState(""),
    [attachments, setAttachments] = useState<AttachmentInput[]>([]),
    [reading, setReading] = useState(false),
    [scheduleDraft, setScheduleDraft] = useState(start);
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
  function addRecipient() {
    if (!recipientInput.trim()) return;
    const parsed = parseLeads(recipientInput);
    if (!parsed.emails.length || parsed.ignored) {
      setError(
        "Enter valid email addresses, separated by commas or new lines.",
      );
      return;
    }
    const next = [...new Set([...recipients, ...parsed.emails])];
    if (next.length > config.maxRecipients) {
      setError(`A batch supports up to ${config.maxRecipients} recipients.`);
      return;
    }
    setRecipients(next);
    setRecipientInput("");
    setError("");
    key.current = crypto.randomUUID();
  }
  function toggleSchedule() {
    setScheduleDraft(start);
    setScheduleOpen(!scheduleOpen);
  }
  function tomorrow(hour: number) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    setScheduleDraft(
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
    );
  }
  async function attach(files: FileList | null) {
    if (!files) return;
    if (attachments.length + files.length > 5) {
      setError("Attach up to 5 files.");
      return;
    }
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
    ];
    const size =
      attachments.reduce(
        (sum, f) => sum + Math.floor((f.data.length * 3) / 4),
        0,
      ) + Array.from(files).reduce((sum, f) => sum + f.size, 0);
    if (size > 5 * 1024 * 1024) {
      setError("Attachments must total 5 MB or less.");
      return;
    }
    setReading(true);
    setError("");
    try {
      const added = await Promise.all(
        Array.from(files).map(async (file) => {
          const type =
            file.type ||
            (/\.csv$/i.test(file.name)
              ? "text/csv"
              : /\.txt$/i.test(file.name)
                ? "text/plain"
                : "");
          if (!allowed.includes(type))
            throw Error("Use PNG, JPEG, GIF, WebP, PDF, CSV or text files.");
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = () => reject(Error("Could not read attachment."));
            reader.readAsDataURL(file);
          });
          return { name: file.name, type, data };
        }),
      );
      setAttachments((current) => [...current, ...added]);
      key.current = crypto.randomUUID();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setReading(false);
    }
  }
  return (
    <div className="overlay page-overlay">
      <div
        className="compose compose-page"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="compose-title"
        ref={panel}
      >
        <div className="editor-topbar flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="icon-button"
              aria-label="Close compose"
              disabled={busy}
              onClick={close}
            >
              <ArrowLeft size={20} />
            </button>
            <h2 id="compose-title">Compose New Email</h2>
          </div>
          <div className="editor-actions flex items-center gap-3">
            <label className="attach-button" title="Attach files">
              <Paperclip size={19} />
              {attachments.length > 0 && <span>{attachments.length}</span>}
              <input
                type="file"
                aria-label="Attach files"
                multiple
                accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv"
                disabled={busy || reading}
                onChange={(e) => {
                  void attach(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              className="icon-button schedule-toggle"
              aria-label="Choose send time"
              aria-expanded={scheduleOpen}
              disabled={busy}
              onClick={toggleSchedule}
            >
              <Clock3 size={19} />
            </button>
            <button
              className="send-later-button"
              aria-label="Schedule emails"
              form="compose-form"
              disabled={busy || reading || !senders.length}
            >
              {busy ? <Loader2 className="spin" size={14} /> : null}Schedule
            </button>
          </div>
        </div>
        <form
          id="compose-form"
          onChange={() => {
            if (!busy) key.current = crypto.randomUUID();
          }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) {
              setError("Enter an email body.");
              return;
            }
            if (body.length > 50000) {
              setError("Keep the message under 50,000 characters.");
              return;
            }
            if (!recipients.length) {
              setError(
                "Upload a lead file with at least one valid email address.",
              );
              return;
            }
            if (
              !start ||
              !Number.isFinite(new Date(start).getTime()) ||
              new Date(start).getTime() < Date.now() - 60000
            ) {
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
                  bodyHtml,
                  attachments,
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
          <fieldset disabled={busy} className="compose-fields editor-fields">
            <div className="editor-line">
              <label htmlFor="sender">From</label>
              <select
                id="sender"
                required
                value={sender}
                onChange={(e) => setSender(e.target.value)}
              >
                <option value="" disabled>
                  Select a sending account
                </option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email}
                  </option>
                ))}
              </select>
            </div>
            {!senders.length && (
              <div className="inline-info">
                <Info size={15} />
                Add a test sender on the Sending accounts page first.
              </div>
            )}
            <div className="editor-line recipient-line">
              <label htmlFor="recipient-input">To</label>
              <div className="recipient-entry flex flex-wrap items-center gap-2">
                {recipients.slice(0, 3).map((email) => (
                  <span className="recipient-chip" key={email}>
                    {email}
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      onClick={() => {
                        setRecipients(recipients.filter((r) => r !== email));
                        key.current = crypto.randomUUID();
                      }}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {recipients.length > 3 && (
                  <span className="recipient-chip">
                    +{recipients.length - 3}
                  </span>
                )}
                <input
                  id="recipient-input"
                  placeholder={
                    recipients.length
                      ? "Add recipient"
                      : "recipient@example.com"
                  }
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onBlur={addRecipient}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addRecipient();
                    }
                  }}
                />
              </div>
              <label
                className={`upload-link ${dragging ? "dragging" : ""}`}
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
                <UploadCloud size={15} />
                Upload List
                <input
                  type="file"
                  aria-label="Upload lead file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    if (e.target.files?.[0]) void upload(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {fileName && (
              <div className="file-summary flex items-center gap-2">
                <FileText size={14} />
                <span>{fileName}</span>
                <strong>
                  {recipients.length.toLocaleString()} unique recipients
                </strong>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove lead file"
                  onClick={resetLeads}
                >
                  <X size={13} />
                </button>
                {(duplicates > 0 || ignored > 0) && (
                  <small>
                    {duplicates > 0
                      ? `${duplicates} duplicate${duplicates === 1 ? "" : "s"} removed. `
                      : ""}
                    {ignored > 0 ? `${ignored} non-email fields ignored.` : ""}
                  </small>
                )}
              </div>
            )}
            <div className="editor-line subject-line">
              <label htmlFor="subject">Subject</label>
              <input
                id="subject"
                required
                maxLength={200}
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="editor-limits flex flex-wrap items-center gap-5">
              <label>
                Delay between emails{" "}
                <input
                  required
                  aria-label="Delay between emails"
                  type="number"
                  step="0.1"
                  min={config.minDelayMs / 1000}
                  max={3600}
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                />
                <span>sec</span>
              </label>
              <label>
                Hourly limit{" "}
                <input
                  aria-label="Hourly limit"
                  required
                  type="number"
                  min={1}
                  max={config.maxHourlyLimit}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                />
              </label>
            </div>
            <RichTextEditor
              disabled={busy}
              onChange={(text, html) => {
                setBody(text);
                setBodyHtml(html);
                key.current = crypto.randomUUID();
              }}
            />
            <div className="attachments-grid">
              {attachments.map((file, index) => (
                <div className="attachment-card" key={index}>
                  {file.type.startsWith("image/") ? (
                    <img
                      src={`data:${file.type};base64,${file.data}`}
                      alt={file.name}
                    />
                  ) : (
                    <div className="attachment-icon">
                      <File size={30} />
                    </div>
                  )}
                  <strong>{file.name}</strong>
                  <small>
                    {((file.data.length * 3) / 4 / 1024).toFixed(1)} KB
                  </small>
                  <button
                    type="button"
                    aria-label={`Remove attachment ${file.name}`}
                    onClick={() => {
                      setAttachments(attachments.filter((_, i) => i !== index));
                      key.current = crypto.randomUUID();
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            {reading && <p role="status">Reading attachments…</p>}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <div className="editor-plan flex flex-wrap items-center justify-between gap-3">
              <span>{recipients.length.toLocaleString()} recipients</span>
              <label className="start-time-field">
                Start time
                <input
                  aria-label="Start sending"
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    key.current = crypto.randomUUID();
                  }}
                />
                <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
              </label>
            </div>
          </fieldset>
        </form>
        {scheduleOpen && (
          <div
            className="schedule-popover"
            role="region"
            aria-label="Send later options"
          >
            <h3>Send Later</h3>
            <label>
              Pick date & time
              <input
                aria-label="Send later date and time"
                type="datetime-local"
                required
                value={scheduleDraft}
                disabled={busy}
                onChange={(e) => {
                  setScheduleDraft(e.target.value);
                }}
              />
            </label>
            <span className="schedule-timezone">
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
            <div className="schedule-presets">
              {[9, 10, 11, 15].map((hour) => (
                <button type="button" key={hour} onClick={() => tomorrow(hour)}>
                  Tomorrow, {hour > 12 ? hour - 12 : hour}:00{" "}
                  {hour >= 12 ? "PM" : "AM"}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="plain-button"
                onClick={() => setScheduleOpen(false)}
              >
                Cancel
              </button>
              <button
                className="send-later-button"
                disabled={!scheduleDraft}
                onClick={() => {
                  setStart(scheduleDraft);
                  key.current = crypto.randomUUID();
                  setScheduleOpen(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
