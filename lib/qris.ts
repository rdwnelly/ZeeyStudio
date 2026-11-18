/**
 * Utilitas QRIS (standar EMVCo MPM) — dipakai server dan browser.
 * Mengubah QRIS statis (mis. dari DANA Bisnis) menjadi QRIS dinamis berisi nominal.
 */

/** CRC-CCITT (0xFFFF) — checksum tag 63 pada QRIS. */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

/** Pecah payload TLV (tag 2 digit, panjang 2 digit, nilai) menjadi Map berurutan. Tag 63 (CRC) diabaikan. */
export function parseQrisTags(payload: string): Map<string, string> {
  const tags = new Map<string, string>();
  let i = 0;
  while (i + 4 <= payload.length) {
    const tag = payload.substring(i, i + 2);
    const len = parseInt(payload.substring(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > payload.length) break;
    if (tag === "63") break;
    tags.set(tag, payload.substring(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return tags;
}

function buildPayload(tags: Map<string, string>): string {
  let base = "";
  for (const tag of Array.from(tags.keys()).sort()) {
    const val = tags.get(tag)!;
    base += `${tag}${val.length.toString().padStart(2, "0")}${val}`;
  }
  base += "6304";
  return base + crc16(base);
}

export type QrisInfo = {
  valid: boolean;
  error?: string;
  isStatic: boolean;
  merchantName: string;
  merchantCity: string;
  nmid: string;
};

/** Validasi struktur & CRC, lalu ambil info merchant (nama, kota, NMID). */
export function getQrisInfo(payload: string): QrisInfo {
  const empty = { isStatic: false, merchantName: "", merchantCity: "", nmid: "" };
  const p = (payload || "").trim();
  if (p.length < 30 || !p.startsWith("000201")) return { valid: false, error: "Bukan payload QRIS (harus diawali 000201).", ...empty };
  const crcPos = p.lastIndexOf("6304");
  if (crcPos !== p.length - 8) return { valid: false, error: "Tag CRC (6304) tidak ditemukan di akhir payload.", ...empty };
  if (crc16(p.slice(0, -4)) !== p.slice(-4).toUpperCase()) return { valid: false, error: "Checksum CRC tidak cocok — QR mungkin terpotong atau salah baca.", ...empty };

  const tags = parseQrisTags(p);
  if (tags.get("53") !== "360") return { valid: false, error: "Mata uang QRIS bukan Rupiah (360).", ...empty };

  // NMID ada di tag 51 (ID.CO.QRIS.WWW), sub-tag 02
  let nmid = "";
  const t51 = tags.get("51");
  if (t51) nmid = parseQrisTags(t51).get("02") || "";

  return {
    valid: true,
    isStatic: tags.get("01") === "11",
    merchantName: tags.get("59") || "",
    merchantCity: tags.get("60") || "",
    nmid,
  };
}

/**
 * Ubah QRIS statis menjadi QRIS dinamis dengan nominal tetap.
 * - tag 01 → "12" (dinamis), tag 54 → nominal (bilangan bulat Rupiah)
 * - tag 55–57 (tip/biaya layanan) dihapus agar pembayar tidak diminta mengisi tip
 * - CRC dihitung ulang
 */
export function generateDynamicQris(staticQris: string, amount: number): string {
  const info = getQrisInfo(staticQris);
  if (!info.valid) throw new Error(info.error || "QRIS tidak valid");
  const nominal = Math.round(amount);
  if (!Number.isFinite(nominal) || nominal <= 0) throw new Error("Nominal QRIS harus lebih dari 0");

  const tags = parseQrisTags(staticQris.trim());
  tags.set("01", "12");
  ["54", "55", "56", "57"].forEach((t) => tags.delete(t));
  tags.set("54", String(nominal));
  return buildPayload(tags);
}
