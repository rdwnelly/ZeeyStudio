/**
 * Konfigurasi web Firebase — satu sumber untuk browser (lib/firebase.ts)
 * dan pemeriksaan kecocokan project di server (lib/firebase-admin.ts).
 *
 * Bawaan: project "zeeystudio". Dapat ditimpa lewat NEXT_PUBLIC_FIREBASE_*
 * (mis. untuk project uji coba terpisah).
 * (Konfigurasi web Firebase bukan rahasia — memang dikirim ke browser.)
 *
 * Catatan: setiap variabel harus ditulis literal `process.env.NEXT_PUBLIC_…`
 * agar Next.js dapat menyisipkannya ke bundle browser.
 */
export const firebaseWebConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDccuXwunmJZxB4LiMo49giRf7R5ovEvS0",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "zeeystudio.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "zeeystudio",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "zeeystudio.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "286326363941",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:286326363941:web:88d0483636de3ea8d36ccc",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};
