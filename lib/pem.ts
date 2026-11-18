/**
 * Normalisasi private key (PEM) dari variabel lingkungan — HANYA untuk server.
 *
 * Kunci service account sering rusak saat disalin ke dashboard hosting:
 * baris baru berubah menjadi spasi atau "\n" literal, terbungkus tanda kutip,
 * memakai CRLF, atau kehilangan header. OpenSSL lalu gagal dengan
 * "error:1E08010C:DECODER routines::unsupported". Fungsi ini membangun ulang
 * PEM yang valid dari bagian base64-nya.
 */
import crypto from "crypto";

/** Cek apakah OpenSSL bisa membaca PEM ini — internal helper tanpa logging. */
function tryParseKey(pem: string): boolean {
  if (!pem) return false;
  try {
    crypto.createPrivateKey(pem);
    return true;
  } catch {
    return false;
  }
}

export function normalizePrivateKey(raw: string): string {
  let k = String(raw || "").trim();
  // Hapus tanda kutip pembungkus
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  // Normalisasi semua varian baris baru:
  // - literal dua-karakter \r dan \n (sering dari dashboard hosting / JSON mentah)
  // - karakter CRLF / CR sesungguhnya
  k = k.replace(/\\r/g, "").replace(/\\n/g, "\n").replace(/\r\n?/g, "\n");

  const m = k.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/);
  const label = m ? m[1].trim() : "PRIVATE KEY";
  const body = (m ? m[2] : k).replace(/[^A-Za-z0-9+/=]/g, "");
  if (!body) return "";
  const lines = body.match(/.{1,64}/g) || [];

  // Google Service Account selalu memakai PKCS#8 ("PRIVATE KEY").
  // Jika label asli "RSA PRIVATE KEY" (PKCS#1), konversi ke PKCS#8
  // karena OpenSSL 3.x di Node ≥18 bisa menolak PKCS#1 saat googleapis sign JWT.
  // Prioritas: PKCS#8 → label asli → PKCS#8 (agar error message konsisten).
  if (label !== "PRIVATE KEY") {
    const pem8 = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
    if (tryParseKey(pem8)) return pem8;
  }

  const pemOriginal = `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
  if (tryParseKey(pemOriginal)) return pemOriginal;

  // Kembalikan format PKCS#8 agar error message konsisten (akan gagal di isUsablePrivateKey)
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

/** true bila OpenSSL dapat membaca kunci ini. */
export function isUsablePrivateKey(pem: string): boolean {
  return tryParseKey(pem);
}

/**
 * Baca kredensial service account dari isi JSON (variabel *_SERVICE_ACCOUNT_KEY).
 * Toleran terhadap JSON yang rusak karena baris baru asli di dalam string
 * private_key (sering terjadi saat menempel JSON berformat ke dashboard).
 */
export function parseServiceAccountJson(raw: string): { client_email: string; private_key: string; project_id?: string } | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const j = JSON.parse(text);
    if (j.client_email && j.private_key) return { client_email: j.client_email, private_key: j.private_key, project_id: j.project_id };
  } catch {
    // lanjut ke ekstraksi toleran di bawah
  }
  const email = text.match(/"client_email"\s*:\s*"([^"]+)"/)?.[1];
  const key = text.match(/"private_key"\s*:\s*"([\s\S]*?-----END [A-Z ]*PRIVATE KEY-----[\s\S]*?)"/)?.[1];
  const projectId = text.match(/"project_id"\s*:\s*"([^"]+)"/)?.[1];
  return email && key ? { client_email: email, private_key: key, project_id: projectId } : null;
}
