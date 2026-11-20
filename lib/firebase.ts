import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, connectAuthEmulator } from "firebase/auth";

import { firebaseWebConfig } from "./firebase-config";

const firebaseConfig = firebaseWebConfig;

// Initialize Firebase (Singleton pattern for Next.js API routes)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Pengembangan/pengujian: hubungkan ke Firebase Emulator lokal (tidak aktif di produksi)
// Aktifkan dengan NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true saat build/dev.
const globalForEmu = globalThis as unknown as { __zeeyEmulatorConnected?: boolean };
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" && typeof window !== "undefined" && !globalForEmu.__zeeyEmulatorConnected) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  globalForEmu.__zeeyEmulatorConnected = true;
}

export { app, db, storage, auth };
