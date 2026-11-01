import { useRef, useEffect } from "react";
import {
  Clock3,
  Send,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownUp,
  Mail,
  RefreshCw,
  X,
  Plus,
} from "lucide-react";
import type { Email, Sender, View, Stats } from "../types";
import { StatusBadge } from "./StatusBadge";
type Props = {
  view: View;
  stats: Stats;
  rows: Email[];
  total: number;
  page: number;
  query: string;
  sender: string;
  status: string;
  senders: Sender[];
  loading: boolean;
  error: string;
  preview: boolean;
  change: (v: View) => void;
  setQuery: (v: string) => void;
  setSender: (v: string) => void;
  setStatus: (v: string) => void;
  setPage: (v: number) => void;
  refresh: () => void;
  compose: () => void;
  select: (email: Email) => void;
};
export function EmailTable(p: Props) {
  const search = useRef<HTMLInputElement>(null);
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
  const filtering = !!(p.query || p.sender || p.status);
  return (
    <section className="email-panel">
      <div className="panel-heading">
        <div className="tabs">
          <button
            className={p.view === "scheduled" ? "selected" : ""}
            onClick={() => p.change("scheduled")}
          >
            <Clock3 size={16} />
            Scheduled<span>{p.stats.scheduled}</span>
          </button>
          <button
            className={p.view === "sent" ? "selected" : ""}
            onClick={() => p.change("sent")}
          >
            <Send size={16} />
            Sent<span>{p.stats.sent}</span>
          </button>
        </div>
        <span className="live">
          <span className="dot" />
          {p.preview ? "Sample workspace" : "Auto-updates every 10s"}
        </span>
      </div>
      <div className="table-tools">
        <div>
          <h2>
            {p.view === "scheduled"
              ? "Your upcoming emails"
              : "Your delivery history"}
            <span>{p.total}</span>
          </h2>
          <p>
            {p.view === "scheduled"
              ? "Thoughtfully planned. Ready for the right moment."
              : "Every conversation you’ve put in motion."}
          </p>
        </div>
        <label className="search">
          <Search size={16} />
          <input
            ref={search}
            aria-label="Search emails"
            placeholder="Search emails…"
            value={p.query}
            onChange={(e) => p.setQuery(e.target.value)}
          />
          {p.query ? (
            <button
              aria-label="Clear search"
              className="icon-button"
              onClick={() => p.setQuery("")}
            >
              <X size={12} />
            </button>
          ) : (
            <kbd>⌘ K</kbd>
          )}
        </label>
      </div>
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
              : ["scheduled", "sending"]
            ).map((s) => (
              <option key={s} value={s}>
                {s === "uncertain"
                  ? "Needs review"
                  : s === "sent"
                    ? "Delivered"
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
              Clear filters
              <X size={12} />
            </button>
          )}
        </div>
        <button
          className="icon-button"
          aria-label="Refresh emails"
          disabled={p.loading}
          onClick={p.refresh}
        >
          <RefreshCw size={15} className={p.loading ? "spin" : ""} />
        </button>
      </div>
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
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>RECIPIENT</th>
                <th>SUBJECT</th>
                <th>
                  {p.view === "sent" ? "SENT AT" : "SCHEDULED FOR"}
                  <ArrowDownUp size={11} />
                </th>
                <th>STATUS</th>
                <th>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {p.loading
                ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }, (_, j) => (
                        <td key={j}>
                          <div className="skeleton" />
                        </td>
                      ))}
                    </tr>
                  ))
                : p.rows.map((e, i) => (
                    <tr key={e.id}>
                      <td>
                        <div className="recipient">
                          <span className={`recipient-avatar tone-${i % 4}`}>
                            {e.recipient[0].toUpperCase()}
                          </span>
                          <div>
                            <button
                              className="recipient-link"
                              onClick={() => p.select(e)}
                            >
                              {e.recipient.split("@")[0].replace(/[._]/g, " ")}
                            </button>
                            <small>{e.recipient}</small>
                          </div>
                        </div>
                      </td>
                      <td className="subject">
                        <button title={e.subject} onClick={() => p.select(e)}>
                          {e.subject}
                        </button>
                        <small>{e.sender_name ?? "Email sender"}</small>
                      </td>
                      <td>
                        <div className="date-cell">
                          <div>
                            {p.view === "sent" && !e.sent_at
                              ? "Not delivered"
                              : new Date(
                                  (p.view === "sent" ? e.sent_at : null) ??
                                    e.scheduled_at,
                                ).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                            <small>
                              {new Date(
                                (p.view === "sent" ? e.sent_at : null) ??
                                  e.scheduled_at,
                              ).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={e.status} />
                      </td>
                      <td>
                        <button
                          className="row-action"
                          aria-label={`View email to ${e.recipient}`}
                          onClick={() => p.select(e)}
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!p.loading && !p.rows.length && (
            <div className="empty">
              <div>{filtering ? <Search size={27} /> : <Mail size={27} />}</div>
              <h3>
                {filtering
                  ? "No emails match those filters"
                  : p.view === "sent"
                    ? "Your next connection is on its way"
                    : "A fresh start for your outreach"}
              </h3>
              <p>
                {filtering
                  ? "Try a different search or clear your filters."
                  : p.view === "sent"
                    ? "Emails appear here once delivery has been attempted."
                    : "Compose your first email and find its perfect moment."}
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
