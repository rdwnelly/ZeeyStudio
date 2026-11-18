import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCjVsdRQzBWyizA10cfRuumKd8_7Qx0Phg",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "zeeystudio-91d12.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "zeeystudio-91d12",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "zeeystudio-91d12.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "848096372305",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:848096372305:web:2b9992753439137748ba70",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-FHHJ58KZBX"
};

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
