/** Use first/last initials only; never send names, email or provider IDs to DiceBear. */
export function nameInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return [parts[0], ...(parts.length > 1 ? [parts.at(-1)!] : [])]
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase();
}
export function profileAvatar(name: string) {
  const params = new URLSearchParams({
    seed: nameInitials(name),
    chars: "2",
    backgroundColor: "00a83c",
    fontFamily: "Arial",
    fontWeight: "600",
  });
  return `https://api.dicebear.com/10.x/initials/svg?${params}`;
}
