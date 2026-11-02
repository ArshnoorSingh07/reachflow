import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../services/api";
import type { AppConfig, EmailPage, Sender, Stats, User, View } from "../types";
import { defaultConfig } from "../config";
export function useWorkspace(
  user: User | null,
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
    [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((x) => x + 1), []);
  useEffect(() => {
    api<AppConfig>("/api/config")
      .then(setConfig)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) {
      setEmails({ rows: [], total: 0, page: 1 });
      setSenders([]);
      setStats({ scheduled: 0, sent: 0, failed: 0, sentToday: 0 });
      setSlack(false);
      setError("");
      setMetadataError("");
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
  }, [user, revision]);
  useEffect(() => {
    if (
      !user ||
      !["scheduled", "sent", "starred", "archived", "trash"].includes(view)
    )
      return;
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
  }, [user, view, page, query, sender, status, revision]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 10000);
    return () => clearInterval(timer);
  }, [user, refresh]);
  return {
    ...emails,
    senders,
    stats,
    slack,
    config,
    loading,
    error,
    metadataError,
    refresh,
  };
}
