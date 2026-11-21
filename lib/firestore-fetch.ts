/**
 * Pembacaan Firestore yang tahan koneksi lambat/putus — khusus browser.
 *
 * Masalah: `getDocs()` TIDAK melempar error saat koneksi belum siap. Firestore
 * diam-diam menjawab dari cache lokal, dan karena aplikasi ini tidak memakai
 * cache permanen, isinya kosong. Akibatnya halaman menampilkan "Belum ada data"
 * padahal sebenarnya koneksi yang belum tersambung — dan karena `getDocs` hanya
 * dipanggil sekali saat halaman dimuat, data TIDAK PERNAH muncul walaupun
 * koneksi kemudian pulih. Ini nyata terjadi setelah berganti akun: sambungan
 * Firestore perlu beberapa detik untuk siap kembali.
 *
 * Solusi: tampilkan hasil pertama apa adanya (UI tidak tertahan), lalu bila
 * jawaban itu berasal dari cache, pasang listener sementara. Firestore otomatis
 * mengirim data begitu tersambung; saat itu `onFresh` dipanggil dan listener
 * langsung dilepas. Bila sampai batas waktu tetap gagal, hasil pertama ditandai
 * `stale` agar halaman bisa memberi tahu pengguna.
 */
import { getDocs, onSnapshot, type Query, type QuerySnapshot, type DocumentData } from "firebase/firestore";

export type FreshResult<T = DocumentData> = {
  snapshot: QuerySnapshot<T>;
  /** true bila hasil ini berasal dari cache (koneksi belum siap). */
  stale: boolean;
};

/**
 * @param onFresh dipanggil sekali bila data dari server menyusul setelah hasil
 *                pertama ternyata hanya berasal dari cache.
 */
export async function getDocsFresh<T = DocumentData>(
  q: Query<T>,
  onFresh?: (snapshot: QuerySnapshot<T>) => void,
  timeoutMs = 20000
): Promise<FreshResult<T>> {
  const first = await getDocs(q);
  if (!first.metadata.fromCache) return { snapshot: first, stale: false };

  if (onFresh) {
    let unsubscribe: (() => void) | null = null;
    let settled = false;
    const stop = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Bisa terpanggil sebelum onSnapshot selesai memberi nilai balik
      queueMicrotask(() => unsubscribe?.());
    };
    const timer = setTimeout(stop, timeoutMs);
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (settled || snap.metadata.fromCache) return;
        stop();
        onFresh(snap);
      },
      (err) => {
        console.error("Gagal memuat data Firestore:", err);
        stop();
      }
    );
    if (settled) unsubscribe();
  }

  return { snapshot: first, stale: true };
}
