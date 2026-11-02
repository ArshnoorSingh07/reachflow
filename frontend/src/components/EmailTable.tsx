import { useRef, useEffect, useState } from "react";
import {
  Clock3,
  Search,
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
  X,
  Plus,
  SlidersHorizontal,
  ArrowRight,
  Star,
} from "lucide-react";
import type { Email, Sender, View } from "../types";
import { StatusBadge } from "./StatusBadge";
type Props = {
  view: View;
  rows: Email[];
  total: number;
  page: number;
  query: string;
  sender: string;
  status: string;
  senders: Sender[];
  loading: boolean;
  error: string;
  setQuery: (v: string) => void;
  setSender: (v: string) => void;
  setStatus: (v: string) => void;
  setPage: (v: number) => void;
  refresh: () => void;
  compose: () => void;
  select: (email: Email) => void;
  toggleStar?: (email: Email) => Promise<void>;
};
export function EmailTable(p: Props) {
  const search = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  const viewTitle = {
    scheduled: "Scheduled emails",
    sent: "Sent emails",
    starred: "Starred emails",
    archived: "Archived emails",
    trash: "Trash",
    senders: "Sending accounts",
    integrations: "Integrations",
  }[p.view];
  const filtering = !!(p.query || p.sender || p.status);
  return (
    <section className="email-panel">
      <h1 className="sr-only">{viewTitle}</h1>
      <div className="mail-toolbar flex items-center gap-3">
        <label className="search">
          <Search size={16} />
          <input
            ref={search}
            aria-label="Search emails"
            placeholder="Search"
            value={p.query}
            onChange={(e) => p.setQuery(e.target.value)}
          />
          {p.query && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => p.setQuery("")}
            >
              <X size={13} />
            </button>
          )}
        </label>
        <button
          className={`icon-button ${showFilters ? "is-active" : ""}`}
          aria-label="Filter emails"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Refresh emails"
          disabled={p.loading}
          onClick={p.refresh}
        >
          <RefreshCw size={16} className={p.loading ? "spin" : ""} />
        </button>
        <span className="mail-toolbar-count">
          {p.total.toLocaleString()} emails
        </span>
      </div>
      {showFilters && (
        <div className="filter-row">
          <div className="filter-controls">
            <select
              aria-label="Filter by sender"
              value={p.sender}
              onChange={(e) => p.setSender(e.target.value)}
            >
              <option value="">All senders</option>
              {p.senders.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              value={p.status}
              onChange={(e) => p.setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {(p.view === "sent"
                ? ["sent", "failed", "uncertain"]
                : p.view === "scheduled"
                  ? ["scheduled", "sending"]
                  : ["scheduled", "sending", "sent", "failed", "uncertain"]
              ).map((s) => (
                <option key={s} value={s}>
                  {s === "uncertain"
                    ? "Needs review"
                    : s === "sent"
                      ? "Sent"
                      : s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            {filtering && (
              <button
                className="clear-filters"
                onClick={() => {
                  p.setQuery("");
                  p.setSender("");
                  p.setStatus("");
                }}
              >
                Clear filters <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}
      {p.error ? (
        <div className="table-error" role="alert">
          <Mail size={24} />
          <h3>We couldn’t load your emails</h3>
          <p>{p.error}</p>
          <button className="secondary" onClick={p.refresh}>
            <RefreshCw size={15} />
            Try again
          </button>
        </div>
      ) : (
        <div className="mail-list" aria-label={viewTitle} aria-busy={p.loading}>
          {p.loading && (
            <span role="status" className="sr-only">
              Loading emails…
            </span>
          )}
          {p.loading
            ? Array.from({ length: 5 }, (_, i) => (
                <div className="mail-row-skeleton" key={i}>
                  <div className="skeleton" />
                </div>
              ))
            : p.rows.map((e) => (
                <div className="mail-row-wrap" key={e.id}>
                  <button
                    className="mail-row"
                    aria-label={`View email to ${e.recipient}`}
                    onClick={() => p.select(e)}
                  >
                    <span className="mail-recipient" title={e.recipient}>
                      To: {e.recipient}
                    </span>
                    <span className="mail-summary">
                      {p.view === "scheduled" ? (
                        <span
                          className={`mail-time ${e.status === "sending" ? "sending" : ""}`}
                        >
                          <Clock3 size={12} />
                          {new Date(e.scheduled_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <StatusBadge status={e.status} />
                      )}
                      <span className="mail-subject">
                        {e.subject}
                        <span className="mail-snippet">
                          {" "}
                          –{" "}
                          {e.body?.replace(/\s+/g, " ") ??
                            `From ${e.sender_name ?? "your sending account"}`}
                        </span>
                      </span>
                    </span>
                    <span className="mail-trailing">
                      {p.view !== "scheduled" && e.sent_at ? (
                        <time dateTime={e.sent_at}>
                          {new Date(e.sent_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      ) : p.view !== "scheduled" ? (
                        <span className="not-delivered">Not sent</span>
                      ) : (
                        <StatusBadge status={e.status} />
                      )}
                      <ArrowRight size={14} />
                    </span>
                  </button>
                  <button
                    className={`star-button ${e.starred ? "starred" : ""}`}
                    aria-label={`${e.starred ? "Unstar" : "Star"} email to ${e.recipient}`}
                    aria-pressed={!!e.starred}
                    disabled={!p.toggleStar}
                    onClick={() => void p.toggleStar?.(e)}
                  >
                    <Star size={17} />
                  </button>
                </div>
              ))}
          {!p.loading && !p.rows.length && (
            <div className="empty">
              <div>{filtering ? <Search size={27} /> : <Mail size={27} />}</div>
              <h3>
                {filtering
                  ? "No emails match those filters"
                  : p.view === "sent"
                    ? "No sent emails yet"
                    : p.view === "scheduled"
                      ? "No scheduled emails"
                      : `No ${viewTitle.toLowerCase()} emails`.replace(
                          "emails emails",
                          "emails",
                        )}
              </h3>
              <p>
                {filtering
                  ? "Try a different search or clear your filters."
                  : p.view === "sent"
                    ? "Emails appear here once delivery has been attempted."
                    : "Compose an email to get started."}
              </p>
              <button
                className="secondary"
                onClick={
                  filtering
                    ? () => {
                        p.setQuery("");
                        p.setSender("");
                        p.setStatus("");
                      }
                    : p.compose
                }
              >
                {filtering ? <X size={16} /> : <Plus size={16} />}{" "}
                {filtering ? "Clear filters" : "Compose an email"}
              </button>
            </div>
          )}
        </div>
      )}
      <div className="table-footer">
        <span>
          {p.total
            ? `Showing ${(p.page - 1) * 12 + 1}–${Math.min(p.page * 12, p.total)} of ${p.total} emails`
            : "No emails to show"}
        </span>
        <div>
          <button
            disabled={p.page === 1 || p.loading}
            className="icon-button"
            aria-label="Previous page"
            onClick={() => p.setPage(p.page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="page-number">{p.page}</span>
          <button
            disabled={p.page * 12 >= p.total || p.loading}
            className="icon-button"
            aria-label="Next page"
            onClick={() => p.setPage(p.page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
