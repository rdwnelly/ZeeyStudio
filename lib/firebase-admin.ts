/**
 * Firebase Admin SDK — HANYA untuk kode server (API Routes).
 *
 * Admin SDK melewati Firestore Security Rules, sehingga seluruh operasi
 * yang dijalankan server (webhook, galeri klien, Drive, login) tetap berjalan
 * setelah rules dikunci untuk akses langsung dari browser.
 *
 * Kredensial (pilih salah satu) di variabel lingkungan server:
 *  - FIREBASE_SERVICE_ACCOUNT_KEY = isi JSON service account Firebase (satu baris)
 *  - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (+ FIREBASE_PROJECT_ID)
 * Saat memakai Firebase Emulator (FIRESTORE_EMULATOR_HOST), kredensial tidak diperlukan.
 */
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { isUsablePrivateKey, normalizePrivateKey, parseServiceAccountJson } from "./pem";
import { firebaseWebConfig } from "./firebase-config";

const DEFAULT_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || firebaseWebConfig.projectId;

/**
 * Kunci Admin harus dari project yang SAMA dengan aplikasi web; jika tidak,
 * token login dari browser ditolak dan server membaca database yang berbeda.
 */
function assertSameProject(keyProjectId: string | undefined) {
  if (keyProjectId && keyProjectId !== firebaseWebConfig.projectId) {
    throw new Error(
      `Project Firebase tidak cocok: kunci Admin milik project "${keyProjectId}", ` +
        `tetapi aplikasi web memakai project "${firebaseWebConfig.projectId}". ` +
        `Isi NEXT_PUBLIC_FIREBASE_* untuk project "${keyProjectId}" (Firebase Console → Project settings → ` +
        `General → Your apps → Web app), atau gunakan kunci service account dari project "${firebaseWebConfig.projectId}".`
    );
  }
}

function cleanKey(key: string): string {
  const pem = normalizePrivateKey(key);
  if (!isUsablePrivateKey(pem)) {
    throw new Error(
      "Private key Firebase Admin tidak dapat dibaca (format PEM rusak atau terpotong). " +
        "Salin ulang seluruh isi berkas JSON service account Firebase ke FIREBASE_SERVICE_ACCOUNT_KEY."
    );
  }
  return pem;
}

function initAdminApp(): App {
  const existing = getApps().find((a) => a.name === "zeey-admin");
  if (existing) return existing;

  const usingEmulator = !!(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
  // Emulator diprioritaskan: pengujian lokal tidak pernah memakai kredensial asli
  if (usingEmulator) {
    return initializeApp({ projectId: DEFAULT_PROJECT_ID }, "zeey-admin");
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const json = parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    if (!json) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY bukan isi JSON service account yang valid (client_email / private_key tidak ditemukan).");
    }
    assertSameProject(json.project_id);
    return initializeApp(
      {
        credential: cert({
          projectId: json.project_id || DEFAULT_PROJECT_ID,
          clientEmail: json.client_email,
          privateKey: cleanKey(json.private_key || ""),
        }),
        projectId: json.project_id || DEFAULT_PROJECT_ID,
      },
      "zeey-admin"
    );
  }

  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return initializeApp(
      {
        credential: cert({
          projectId: DEFAULT_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: cleanKey(process.env.FIREBASE_PRIVATE_KEY),
        }),
        projectId: DEFAULT_PROJECT_ID,
      },
      "zeey-admin"
    );
  }

  throw new Error(
    "Kredensial Firebase Admin belum diatur. Isi FIREBASE_SERVICE_ACCOUNT_KEY (JSON service account dari " +
      "Firebase Console → Project settings → Service accounts) di variabel lingkungan server."
  );
}

export function adminDb() {
  return getFirestore(initAdminApp());
}

export function adminAuth() {
  return getAuth(initAdminApp());
}

export type StaffClaims = DecodedIdToken & {
  role?: "owner" | "admin";
  accesses?: string[];
  adminName?: string;
};

/**
 * Verifikasi header `Authorization: Bearer <Firebase ID token>`.
 * Mengembalikan klaim pengguna bila ia staf (owner/admin), selain itu null.
 */
export async function verifyStaff(request: Request, opts: { ownerOnly?: boolean } = {}): Promise<StaffClaims | null> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    const decoded = (await adminAuth().verifyIdToken(token)) as StaffClaims;
    if (decoded.role === "owner") return decoded;
    if (decoded.role === "admin" && !opts.ownerOnly) return decoded;
    return null;
  } catch {
    return null;
  }
}

/** Daftar email Owner yang diizinkan (variabel OWNER_EMAILS, dipisah koma). */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
