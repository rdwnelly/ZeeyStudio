/**
 * Logika server untuk galeri klien (/client/[id]).
 * Galeri tidak lagi mengakses Firestore langsung; semua baca/tulis lewat
 * API Route yang memakai Admin SDK dan memvalidasi setiap perubahan.
 */
import { adminDb } from "@/lib/firebase-admin";
import { calculateBill, withDefaultPrices, type BillPriceItem } from "@/lib/billing";

export type SubToken = {
  id: string;
  name: string;
  maxPhotos: number;
  selectedPhotoIds?: string[];
  previouslySelectedPhotoIds?: string[];
  status?: "Menunggu Pemilihan" | "Selesai";
  completedAt?: string;
};

export type ProjectDoc = {
  id: string;
  clientName: string;
  waNumber?: string;
  maxPhotos: number;
  subTokens?: SubToken[];
  createdAt?: string;
  status?: string;
  packagePrice?: number;
  packageName?: string;
  dpAmount?: number;
  selectedPhotoIds?: string[];
  previouslySelectedPhotoIds?: string[];
  selectedAddons?: Record<string, number>;
  isReopened?: boolean;
  completedAt?: string;
  paymentProofStatus?: "pending" | "verified" | "rejected";
  gdriveFolderId?: string;
  gdriveLinkHighRes?: string;
  gdriveLinkWatermark?: string;
  createdBy?: string;
  assignedAdmin?: string;
};

export const DONE_STATUSES = ["Selesai", "File Terkirim"];

/** ID dokumen Firestore yang valid (tanpa "/", bukan "." / "..", bukan pola cadangan __…__). */
function isValidDocId(id: string): boolean {
  return !!id && id.length <= 1500 && !id.includes("/") && id !== "." && id !== ".." && !/^__.*__$/.test(id);
}

export async function loadProject(id: string): Promise<ProjectDoc | null> {
  if (!isValidDocId(id)) return null;
  const snap = await adminDb().collection("projects").doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as ProjectDoc) : null;
}

export async function loadPriceList(): Promise<BillPriceItem[]> {
  const snap = await adminDb().collection("pricelist").get();
  const items = snap.docs.map((d) => {
    const data = d.data();
    return { ...data, id: data.id || d.id } as BillPriceItem;
  });
  return withDefaultPrices(items);
}

export function findSubToken(p: ProjectDoc, token?: string | null): SubToken | undefined {
  if (!token || !p.subTokens?.length) return undefined;
  return p.subTokens.find((st) => st.id === token);
}

/** Galeri terkunci bila proyek/sub-token sudah selesai dan tidak sedang dibuka kembali. */
export function isLocked(p: ProjectDoc, sub?: SubToken): boolean {
  if (p.isReopened) return false;
  if (sub) return sub.status === "Selesai";
  return DONE_STATUSES.includes(p.status || "");
}

/** Data proyek yang aman dikirim ke browser klien (tanpa tautan Drive & data pembayaran mentah). */
export function toClientView(p: ProjectDoc) {
  return {
    id: p.id,
    clientName: p.clientName,
    maxPhotos: p.maxPhotos || 0,
    subTokens: (p.subTokens || []).map((st) => ({
      id: st.id,
      name: st.name,
      maxPhotos: st.maxPhotos,
      status: st.status,
      selectedPhotoIds: st.selectedPhotoIds,
      previouslySelectedPhotoIds: st.previouslySelectedPhotoIds,
    })),
    createdAt: p.createdAt || "",
    status: p.status,
    packagePrice: p.packagePrice || 0,
    packageName: p.packageName || "",
    dpAmount: p.dpAmount || 0,
    // Jangan diganti [] bila tidak ada: galeri memakai `previouslySelectedPhotoIds || selectedPhotoIds`
    selectedPhotoIds: p.selectedPhotoIds,
    previouslySelectedPhotoIds: p.previouslySelectedPhotoIds,
    selectedAddons: p.selectedAddons || {},
    isReopened: !!p.isReopened,
    completedAt: p.completedAt,
    paymentProofStatus: p.paymentProofStatus,
    hasDriveFolder: !!(p.gdriveFolderId || p.gdriveLinkHighRes || p.gdriveLinkWatermark),
  };
}

/** Bersihkan input pilihan foto dari browser. */
export function sanitizeSelection(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.filter((x): x is string => typeof x === "string" && /^[\w-]{5,200}$/.test(x)))).slice(0, 5000);
}

export function sanitizeAddons(addons: unknown, priceList: BillPriceItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (!addons || typeof addons !== "object") return out;
  for (const [id, qty] of Object.entries(addons as Record<string, unknown>)) {
    const n = Math.floor(Number(qty));
    if (priceList.some((p) => p.id === id) && n > 0 && n <= 1000) out[id] = n;
  }
  return out;
}

export function billFor(p: ProjectDoc, sub: SubToken | undefined, selectedCount: number, addons: Record<string, number>, priceList: BillPriceItem[]) {
  return calculateBill({
    packagePrice: p.packagePrice,
    dpAmount: p.dpAmount,
    maxPhotos: sub ? sub.maxPhotos : p.maxPhotos,
    selectedCount,
    addons,
    priceList,
  });
}

/**
 * Tandai pilihan foto sebagai final (setara fungsi lama updateProjectStatusToSelesai di browser).
 * Dipanggil hanya setelah server memastikan tagihan Rp0 atau pembayaran terverifikasi.
 */
export async function finalizeSelection(p: ProjectDoc, sub: SubToken | undefined, selectedIds: string[], addons: Record<string, number>, totalExtraCost: number) {
  const now = new Date().toISOString();
  const ref = adminDb().collection("projects").doc(p.id);

  if (sub && p.subTokens?.length) {
    const updatedSubTokens = p.subTokens.map((st) =>
      st.id === sub.id
        ? { ...st, selectedPhotoIds: selectedIds, previouslySelectedPhotoIds: selectedIds, status: "Selesai" as const, completedAt: now }
        : st
    );
    const combined = new Set<string>();
    updatedSubTokens.forEach((st) => (st.selectedPhotoIds || []).forEach((id) => combined.add(id)));
    const allDone = updatedSubTokens.every(
      (st) => st.status === "Selesai" || (st.selectedPhotoIds && st.selectedPhotoIds.length >= st.maxPhotos)
    );
    const update: Record<string, unknown> = {
      subTokens: updatedSubTokens,
      selectedPhotoIds: Array.from(combined),
      previouslySelectedPhotoIds: Array.from(combined),
      extraRevenue: totalExtraCost,
      selectedAddons: addons,
      isReopened: false,
    };
    if (allDone && !DONE_STATUSES.includes(p.status || "")) {
      update.status = "Selesai";
      update.completedAt = now;
    }
    await ref.update(update);
    return;
  }

  const update: Record<string, unknown> = {
    extraRevenue: totalExtraCost,
    selectedAddons: addons,
    selectedPhotoIds: selectedIds,
    previouslySelectedPhotoIds: selectedIds,
    isReopened: false,
  };
  // Jangan turunkan status "File Terkirim" yang sudah ditutup admin
  if (p.status !== "File Terkirim") {
    update.status = "Selesai";
    update.completedAt = now;
  }
  await ref.update(update);
}
