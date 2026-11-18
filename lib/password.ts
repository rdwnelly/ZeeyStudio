/**
 * Hash kata sandi admin (hanya dipakai di server / API Route).
 * PBKDF2-SHA256, 100.000 iterasi, salt acak 16 byte.
 */
import crypto from "crypto";

const ITERATIONS = 100_000;
const KEYLEN = 32;

export function hashPassword(password: string, salt?: string): { passwordHash: string; passwordSalt: string } {
  const passwordSalt = salt || crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.pbkdf2Sync(password, passwordSalt, ITERATIONS, KEYLEN, "sha256").toString("hex");
  return { passwordHash, passwordSalt };
}

export function verifyPassword(password: string, passwordHash: string, passwordSalt: string): boolean {
  const { passwordHash: computed } = hashPassword(password, passwordSalt);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(passwordHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
