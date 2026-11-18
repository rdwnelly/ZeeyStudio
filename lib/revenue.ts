/**
 * Aturan pendapatan tunggal yang dipakai Dasbor dan modul Keuangan,
 * agar angka omzet di kedua halaman selalu sama.
 *
 * - Proyek lunas/selesai  → harga paket + pendapatan tambahan (foto ekstra & add-on)
 * - Proyek belum lunas     → uang muka (DP) yang sudah diterima
 */
export type RevenueProject = {
  status?: string;
  packagePrice?: number;
  extraRevenue?: number;
  dpAmount?: number;
  createdAt?: string;
  completedAt?: string;
};

export const PAID_STATUSES = ["Selesai", "File Terkirim", "Lunas"];

export function isPaidProject(p: RevenueProject): boolean {
  return PAID_STATUSES.includes(p.status || "");
}

export function projectRevenue(p: RevenueProject): number {
  if (isPaidProject(p)) return (Number(p.packagePrice) || 0) + (Number(p.extraRevenue) || 0);
  return Number(p.dpAmount) || 0;
}

/** Tanggal pengakuan pendapatan: tanggal pelunasan bila ada, jika tidak tanggal booking. */
export function revenueDate(p: RevenueProject): Date {
  const raw = (isPaidProject(p) && p.completedAt) || p.createdAt || "";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
