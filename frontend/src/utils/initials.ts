export function nameInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return [parts[0], ...(parts.length > 1 ? [parts.at(-1)!] : [])]
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase();
}
