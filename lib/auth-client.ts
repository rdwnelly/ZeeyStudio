/**
 * Utilitas autentikasi di browser untuk dasbor staf.
 */
import { auth } from "@/lib/firebase";

/** ID token Firebase pengguna yang sedang login (null bila belum login). */
export async function getIdTokenSafe(): Promise<string | null> {
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

/** fetch() yang otomatis menyertakan header Authorization: Bearer <ID token>. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdTokenSafe();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export function clearLocalSession() {
  localStorage.removeItem("zeey_auth_role");
  localStorage.removeItem("zeey_auth_access");
  localStorage.removeItem("zeey_auth_user");
}

/**
 * Hapus sisa data Firebase di browser saat keluar akun.
 *
 * Firebase Auth menyimpan sesi di IndexedDB. Bila sisa sesi akun sebelumnya
 * masih ada ketika akun lain masuk di browser yang sama, klien Firestore bisa
 * gagal tersambung: permintaan pertamanya menggantung sampai batas waktu 10
 * detik lalu dijawab dari cache kosong, sehingga dasbor tampak "tidak punya
 * data" padahal datanya ada. Membersihkannya saat keluar akun membuat akun
 * berikutnya mulai dari keadaan bersih.
 */
export async function clearFirebaseBrowserState(): Promise<void> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return;
  const hapus = (name: string) =>
    new Promise<void>((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
        setTimeout(resolve, 1500); // jangan menahan proses keluar akun
      } catch {
        resolve();
      }
    });
  try {
    // `databases()` belum ada di sebagian browser lama → pakai nama bawaan Firebase
    const daftar = indexedDB.databases
      ? (await indexedDB.databases()).map((d) => d.name).filter((n): n is string => !!n && n.startsWith("firebase"))
      : ["firebaseLocalStorageDb", "firebase-heartbeat-database"];
    await Promise.all(daftar.map(hapus));
  } catch (err) {
    console.warn("Gagal membersihkan data Firebase di browser:", err);
  }
}
