"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { clearLocalSession } from "@/lib/auth-client";

/**
 * Gerbang autentikasi untuk seluruh halaman /dashboard.
 *
 * Halaman dasbor membaca Firestore langsung dari browser, dan Firestore Security Rules
 * mewajibkan pengguna login dengan klaim peran (owner/admin). Layout ini menahan
 * halaman sampai sesi Firebase dipulihkan dan klaim peran terverifikasi, lalu
 * menyelaraskan sesi lokal (localStorage) dari klaim token sebagai sumber kebenaran.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        clearLocalSession();
        setReady(false);
        router.replace("/");
        return;
      }
      try {
        const { claims } = await user.getIdTokenResult();
        const role = claims.role;
        if (role !== "owner" && role !== "admin") {
          await signOut(auth);
          return; // onAuthStateChanged akan terpanggil lagi dengan user = null
        }
        localStorage.setItem("zeey_auth_role", role);
        if (role === "admin") {
          const accesses = Array.isArray(claims.accesses) ? claims.accesses : [];
          localStorage.setItem("zeey_auth_access", JSON.stringify(accesses));
          localStorage.setItem("zeey_auth_user", String(claims.adminName || "Admin"));
        } else {
          localStorage.removeItem("zeey_auth_access");
          localStorage.setItem("zeey_auth_user", "Owner");
        }
        setReady(true);
      } catch (err) {
        console.error("Gagal memverifikasi sesi:", err);
        clearLocalSession();
        router.replace("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-2xl animate-aurora" />
          <div className="absolute inset-[3px] rounded-[13px] bg-background flex items-center justify-center">
            <div className="w-6 h-6 border-[3px] border-accent/25 border-t-accent rounded-full animate-spin" />
          </div>
        </div>
        <p className="text-sm font-medium text-foreground/60">Memverifikasi sesi Anda...</p>
      </div>
    );
  }

  return <>{children}</>;
}
