/**
 * Normalisasi nomor WhatsApp Indonesia ke format internasional tanpa "+".
 * Contoh: "0812-3456-789" → "628123456789", "+62 812…" → "62812…", "812…" → "62812…".
 * Dipakai untuk tautan wa.me dan sebagai kunci identitas klien di CRM,
 * sehingga 08… dan 628… dianggap nomor yang sama.
 */
export function normalizeWaNumber(raw?: string | null): string {
  if (!raw) return "";
  let n = String(raw).replace(/\D/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  else if (n.startsWith("8")) n = "62" + n;
  return n;
}

/** Bangun tautan wa.me dengan pesan yang sudah di-encode. */
export function waLink(raw: string | null | undefined, message: string): string {
  return `https://wa.me/${normalizeWaNumber(raw)}?text=${encodeURIComponent(message)}`;
}
