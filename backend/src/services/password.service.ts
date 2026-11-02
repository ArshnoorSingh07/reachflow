import { randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";
const scrypt = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    derive(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 67108864 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt);
  return `scrypt$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [scheme, salt, encoded] = hash.split("$");
  if (scheme !== "scrypt" || !salt || !encoded || encoded.length !== 128)
    return false;
  const key = await scrypt(password, salt);
  return timingSafeEqual(key, Buffer.from(encoded, "hex"));
}
