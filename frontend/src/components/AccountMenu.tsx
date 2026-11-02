import { ProfileAvatar } from "./ProfileAvatar";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LogOut,
  ShieldCheck,
  Monitor,
  Loader2,
} from "lucide-react";
import type { User } from "../types";
export function AccountMenu({
  user,
  onLogout,
}: {
  user: User;
  onLogout: (all: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, []);
  async function logout(all: boolean) {
    setBusy(true);
    try {
      await onLogout(all);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }
  return (
    <div className="header-right account-root" ref={root}>
      <button
        className="account-trigger"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
      >
        <ProfileAvatar user={user} />
        <span className="account-name">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-menu-heading">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <small>
              <ShieldCheck size={13} />
              {`${user.provider === "password" ? "Password account" : "Google account"} · ${user.isAdmin ? "Operator" : "Member"}`}
            </small>
          </div>
          <button
            role="menuitem"
            disabled={busy}
            onClick={() => void logout(false)}
          >
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <LogOut size={16} />
            )}{" "}
            Logout
          </button>
          <button
            role="menuitem"
            disabled={busy}
            onClick={() => void logout(true)}
          >
            <Monitor size={16} />
            Sign out all devices
          </button>
        </div>
      )}
    </div>
  );
}
