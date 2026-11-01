import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
export function seal(value: string) {
  const iv = randomBytes(12);
  const c = createCipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.ENCRYPTION_KEY!, "hex"),
    iv,
  );
  return (() => {
    const encrypted = Buffer.concat([c.update(value), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), encrypted]).toString("base64");
  })();
}
export function unseal(value: string) {
  const b = Buffer.from(value, "base64");
  const c = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.ENCRYPTION_KEY!, "hex"),
    b.subarray(0, 12),
  );
  c.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([c.update(b.subarray(28)), c.final()]).toString();
}
