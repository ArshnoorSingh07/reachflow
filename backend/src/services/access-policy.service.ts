import { timingSafeEqual } from "node:crypto";
export function isOperator(email: string) {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
export function equalToken(expected: unknown, actual: unknown) {
  if (
    typeof expected !== "string" ||
    typeof actual !== "string" ||
    !expected ||
    expected.length !== actual.length
  )
    return false;
  const a = Buffer.from(expected),
    b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function sessionExpired(
  authenticatedAt: unknown,
  lastActivityAt: unknown,
  now: number,
  idleMs: number,
  absoluteMs: number,
) {
  return (
    typeof authenticatedAt !== "number" ||
    typeof lastActivityAt !== "number" ||
    authenticatedAt > now ||
    lastActivityAt > now ||
    now - authenticatedAt >= absoluteMs ||
    now - lastActivityAt >= idleMs
  );
}
