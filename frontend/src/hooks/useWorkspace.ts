import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../services/api";
import type { AppConfig, EmailPage, Sender, Stats, User, View } from "../types";
import {
  defaultConfig,
  previewEmails,
  previewSenders,
  previewStats,
} from "../utils/preview";
export function useWorkspace(
  user: User | null,
  preview: boolean,
  view: View,
  page: number,
  query: string,
  sender: string,
  status: string,
  onSessionExpired: () => void,
) {
  const [emails, setEmails] = useState<EmailPage>({
      rows: [],
      total: 0,
      page: 1,
    }),
    [senders, setSenders] = useState<Sender[]>([]),
    [stats, setStats] = useState<Stats>({
      scheduled: 0,
      sent: 0,
      failed: 0,
      sentToday: 0,
    }),
    [slack, setSlack] = useState(false),
    [config, setConfig] = useState<AppConfig>(defaultConfig),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [metadataError, setMetadataError] = useState(""),
    [revision, setRevision] = useState(0),
    [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const refresh = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    api<AppConfig>("/api/config")
      .then(setConfig)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) return;
    if (preview) {
      setSenders(previewSenders);
      setStats(previewStats);
      return;
    }
    let active = true;
    Promise.all([
      api<Sender[]>("/api/senders"),
      api<Stats>("/api/stats"),
      api<{ slack: boolean }>("/api/integrations"),
    ])
      .then(([s, t, i]) => {
        if (active) {
          setSenders(s);
          setStats(t);
          setSlack(i.slack);
          setMetadataError("");
        }
      })
      .catch((e) => {
        if (active) {
          setMetadataError(e.message);
          if (e instanceof ApiError && e.status === 401) onSessionExpired();
        }
      });
    return () => {
      active = false;
    };
  }, [user, preview, revision]);
  useEffect(() => {
    if (!user || !["scheduled", "sent"].includes(view)) return;
    if (preview) {
      const filtered = previewEmails(view === "sent").filter(
        (x) =>
          (!sender || x.sender_id === sender) &&
          (!status || x.status === status) &&
          (x.recipient + " " + x.subject)
            .toLowerCase()
            .includes(query.toLowerCase()),
      );
      setEmails({
        rows: filtered.slice((page - 1) * 12, page * 12),
        total: filtered.length,
        page,
      });
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      api<EmailPage>(
        `/api/emails?${new URLSearchParams({ view, page: String(page), q: query, sender, status })}`,
        { signal: controller.signal },
      )
        .then((data) => {
          setEmails(data);
          setError("");
          setUpdatedAt(new Date());
        })
        .catch((e) => {
          if (e.name !== "AbortError") {
            setError(e.message);
            setEmails({ rows: [], total: 0, page });
            if (e instanceof ApiError && e.status === 401) onSessionExpired();
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [user, preview, view, page, query, sender, status, revision]);
  useEffect(() => {
    if (!user || preview) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 10000);
    return () => clearInterval(timer);
  }, [user, preview, refresh]);
  return {
    ...emails,
    senders,
    stats,
    slack,
    setSlack,
    config,
    loading,
    error,
    metadataError,
    refresh,
    updatedAt,
  };
}
