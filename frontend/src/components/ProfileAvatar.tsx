import { nameInitials } from "../utils/initials";
import { useState } from "react";
import type { User } from "../types";
export function ProfileAvatar({
  user,
  className = "avatar",
}: {
  user: User;
  className?: string;
}) {
  const src = user.avatar;
  const [failed, setFailed] = useState<string | null>(null);
  return !src || failed === src ? (
    <span className={className} aria-label={`${user.name}'s profile`}>
      {nameInitials(user.name)}
    </span>
  ) : (
    <img
      className={className}
      src={src}
      alt={`${user.name}'s profile`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
    />
  );
}
