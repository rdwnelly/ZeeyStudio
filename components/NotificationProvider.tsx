"use client";

import { useEffect, useRef } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const isInitialProjects = useRef(true);

  useEffect(() => {
    // Request permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const role = localStorage.getItem("zeey_auth_role");
    const name = localStorage.getItem("zeey_auth_user");
    
    if (!role || !name) return;

    // Listen to projects changes
    const qProjects = query(collection(db, "projects"));
    const unsubscribeProjects = onSnapshot(qProjects, (snapshot) => {
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
    });

    return () => {
      unsubscribeProjects();
    };
  }, []);

  const sendNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { 
        body, 
        icon: "/icons/icon-192x192.png"
      });
    }
  };

  return <>{children}</>;
}
