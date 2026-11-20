/**
 * Validasi di sisi server bahwa foto resolusi penuh hanya boleh diambil
 * untuk proyek yang sudah dibayar dan hanya untuk foto yang dipilih klien.
 */
import { adminDb } from "@/lib/firebase-admin";

type SubTokenLike = { status?: string; selectedPhotoIds?: string[]; previouslySelectedPhotoIds?: string[] };

const PAID = ["Selesai", "File Terkirim"];

/** Kembalikan himpunan ID foto yang boleh diunduh untuk proyek ini (kosong = tidak boleh). */
export async function getDownloadablePhotoIds(projectId: string): Promise<Set<string>> {
  const allowed = new Set<string>();
  if (!projectId || projectId.includes("/") || /^__.*__$/.test(projectId)) return allowed;
  const snap = await adminDb().collection("projects").doc(projectId).get();
  if (!snap.exists) return allowed;
  const p = snap.data() || {};

  const projectPaid = PAID.includes(p.status) || p.paymentProofStatus === "verified";
  const add = (ids?: string[]) => (ids || []).forEach((id) => allowed.add(id));

  if (projectPaid) {
    add(p.selectedPhotoIds);
    add(p.previouslySelectedPhotoIds);
  } else if (p.isReopened) {
    // Sesi dibuka kembali: foto yang sudah dibayar pada sesi sebelumnya tetap boleh diunduh
    add(p.previouslySelectedPhotoIds);
  }
  for (const st of (p.subTokens || []) as SubTokenLike[]) {
    if (projectPaid || st.status === "Selesai") {
      add(st.selectedPhotoIds);
      add(st.previouslySelectedPhotoIds);
    }
  }
  return allowed;
}

export async function filterDownloadable(projectId: string, ids: string[]): Promise<{ allowed: string[]; denied: string[] }> {
  const set = await getDownloadablePhotoIds(projectId);
  const allowed: string[] = [];
  const denied: string[] = [];
  for (const id of ids) (set.has(id) ? allowed : denied).push(id);
  return { allowed, denied };
}
