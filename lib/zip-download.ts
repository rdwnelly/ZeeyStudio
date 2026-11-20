/**
 * Rencana unduhan ZIP foto pilihan klien — HANYA untuk server.
 *
 * Batas Vercel: respons streaming bebas dari batas 4,5 MB, tetapi total durasi
 * fungsi (termasuk waktu mengirim respons) maks. 300 detik di paket Hobby.
 * Karena itu foto dibagi menjadi beberapa ZIP ("bagian") dengan ukuran maksimum
 * ZIP_PART_MAX_MB (bawaan 150 MB) agar tiap unduhan selesai walau koneksi HP lambat.
 */
import { getDownloadablePhotoIds } from "@/lib/photo-access";
import { getDriveService, getPhotosInFolder } from "@/lib/drive";
import { extractGDriveFolderId } from "@/lib/drive-utils";
import { findSubToken, type ProjectDoc } from "@/lib/client-project";

export type ZipFile = { id: string; name: string; size: number };
export type ZipPart = { part: number; files: ZipFile[]; bytes: number };

const ESTIMATED_PHOTO_BYTES = 8 * 1024 * 1024; // bila ukuran tidak diketahui

export function partMaxBytes(): number {
  const mb = Number(process.env.ZIP_PART_MAX_MB) || 150;
  return Math.max(10, mb) * 1024 * 1024;
}

/** Nama berkas aman & unik di dalam ZIP. */
function uniqueNames(files: ZipFile[]): ZipFile[] {
  const used = new Map<string, number>();
  return files.map((f, i) => {
    let name = (f.name || `foto_${i + 1}.jpg`).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim() || `foto_${i + 1}.jpg`;
    const key = name.toLowerCase();
    const n = used.get(key) || 0;
    used.set(key, n + 1);
    if (n > 0) {
      const dot = name.lastIndexOf(".");
      name = dot > 0 ? `${name.slice(0, dot)} (${n + 1})${name.slice(dot)}` : `${name} (${n + 1})`;
    }
    return { ...f, name };
  });
}

/**
 * Foto yang boleh diunduh klien ini: pilihan miliknya (sub-token bila ada)
 * ∩ foto yang sudah dibayar ∩ foto yang benar-benar ada di folder Drive proyek.
 */
export async function resolveZipFiles(project: ProjectDoc, token?: string | null): Promise<ZipFile[]> {
  const sub = findSubToken(project, token);
  // Pemegang sub-token hanya mendapat foto pilihannya sendiri (tidak jatuh ke pilihan klien utama)
  const selected = (sub ? sub.selectedPhotoIds : project.selectedPhotoIds) || [];
  const allowed = await getDownloadablePhotoIds(project.id);
  const ids = Array.from(new Set(selected.filter((id) => allowed.has(id))));
  if (ids.length === 0) return [];

  const meta = new Map<string, { name: string; size: number }>();
  const folderId =
    extractGDriveFolderId(project.gdriveFolderId) ||
    extractGDriveFolderId(project.gdriveLinkHighRes) ||
    extractGDriveFolderId(project.gdriveLinkWatermark);
  if (folderId) {
    const files = await getPhotosInFolder(folderId);
    for (const f of files) meta.set(f.id, { name: f.name, size: Number(f.size) || 0 });
  }

  // Foto pilihan yang tidak ditemukan di listing folder: ambil metadatanya langsung
  const missing = ids.filter((id) => !meta.has(id));
  if (missing.length) {
    const drive = await getDriveService();
    await Promise.all(
      missing.map(async (id) => {
        try {
          const r = await drive.files.get({ fileId: id, fields: "name,size", supportsAllDrives: true });
          meta.set(id, { name: r.data.name || "", size: Number(r.data.size) || 0 });
        } catch {
          /* foto sudah dihapus dari Drive — dilewati */
        }
      })
    );
  }

  return uniqueNames(
    ids.filter((id) => meta.has(id)).map((id) => ({ id, name: meta.get(id)!.name, size: meta.get(id)!.size }))
  );
}

/** Bagi foto menjadi beberapa ZIP berdasarkan ukuran (urutan dipertahankan). */
export function planZipParts(files: ZipFile[], maxBytes = partMaxBytes()): ZipPart[] {
  const parts: ZipPart[] = [];
  let current: ZipPart = { part: 1, files: [], bytes: 0 };
  for (const f of files) {
    const size = f.size || ESTIMATED_PHOTO_BYTES;
    if (current.files.length > 0 && current.bytes + size > maxBytes) {
      parts.push(current);
      current = { part: parts.length + 1, files: [], bytes: 0 };
    }
    current.files.push(f);
    current.bytes += size;
  }
  if (current.files.length) parts.push(current);
  return parts;
}

export function zipFileName(clientName: string, part: number, totalParts: number): string {
  const safe = (clientName || "Klien").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "Klien";
  return totalParts > 1 ? `Foto_${safe}_bagian-${part}-dari-${totalParts}.zip` : `Foto_${safe}.zip`;
}
