"use client";

import { useEffect, useRef } from "react";
import { collection, onSnapshot, query, type QuerySnapshot, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";

function sendNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icons/icon-192x192.png" });
  }
}

/**
 * Pemantau pesanan baru (notifikasi desktop).
 *
 * `enabled` dibuat terbatas pada Dasbor Utama: tiap aliran (stream) realtime
 * Firestore menahan satu koneksi, sedangkan browser membatasi ±6 koneksi per
 * host. Bila setiap halaman membuka aliran sendiri, kuota itu habis setelah
 * beberapa kali pindah halaman dan kueri Firestore berikutnya ikut mengantre
 * sampai gagal. Membatasinya juga menghemat baterai & kuota di HP.
 */
export function NotificationProvider({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  const isInitialProjects = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    // Request permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const role = localStorage.getItem("zeey_auth_role");
    const name = localStorage.getItem("zeey_auth_user");

    if (!role || !name) return;

    const handleSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      if (isInitialProjects.current) {
        isInitialProjects.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();

        // Pemicu Notifikasi Owner/Admin
        if ((role === "owner" || role === "admin") && change.type === "added") {
          sendNotification("Pesanan Baru Masuk!", `Ada pesanan baru dari klien ${data.clientName}.`);
        }

        if (role === "owner" && change.type === "modified" && data.status === "Lunas") {
          sendNotification("Pembayaran Diterima 💰", `Pesanan ${data.clientName} telah ditandai lunas.`);
        }

        // Pemicu Notifikasi Editor
        if (role === "admin_editor" && (change.type === "added" || change.type === "modified") && data.status === "Menunggu Pemilihan") {
          sendNotification("Tugas Edit Baru! 🎨", `Klien ${data.clientName} perlu di-edit fotonya (Folder GDrive sudah tersedia).`);
        }
      });
    };

    /**
     * Pantau perubahan proyek hanya selama tab terlihat.
     *
     * Aliran (stream) Firestore ditutup saat tab disembunyikan atau halaman
     * ditinggalkan. Tanpa ini setiap perpindahan halaman menyisakan satu koneksi
     * "Listen/channel" yang menggantung; browser membatasi ±6 koneksi per host,
     * sehingga setelah beberapa kali pindah halaman permintaan Firestore
     * berikutnya ikut mengantre dan data dasbor gagal dimuat.
     */
    const qProjects = query(collection(db, "projects"));
    let unsubscribe: (() => void) | null = null;

    const stop = () => {
      unsubscribe?.();
      unsubscribe = null;
    };
    const sync = () => {
      if (document.visibilityState === "visible") {
        if (!unsubscribe) unsubscribe = onSnapshot(qProjects, handleSnapshot);
      } else {
        stop();
      }
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", stop);

    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [enabled]);

  return <>{children}</>;
}
