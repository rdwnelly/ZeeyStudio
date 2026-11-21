"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { NotificationProvider } from "./NotificationProvider";
import BottomNav from "./BottomNav";
import { Icon } from "./ui";
import { clearFirebaseBrowserState } from "@/lib/auth-client";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { NAV_MODULES, isActivePath, moduleForPath, type NavModule } from "@/lib/nav-modules";

/**
 * Kerangka dasbor (sidebar desktop, header & bilah bawah HP).
 *
 * Dipasang SEKALI di app/dashboard/layout.tsx sehingga tetap ada saat berpindah menu —
 * tidak berkedip/memuat ulang, hanya isi halaman yang berganti dengan animasi.
 * Halaman yang masih membungkus dirinya dengan <Sidebar> otomatis menjadi "tembus"
 * (tidak membuat kerangka kedua).
 */
const ShellContext = createContext(false);

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const insideShell = useContext(ShellContext);
  if (insideShell) return <>{children}</>;
  return (
    <ShellContext.Provider value={true}>
      <DashboardShell>{children}</DashboardShell>
    </ShellContext.Provider>
  );
}

const SUN = "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z";
const MOON = "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z";
const LOGOUT = "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1";

function readSession() {
  if (typeof window === "undefined") return { role: null as string | null, name: "", accesses: [] as string[] };
  const role = localStorage.getItem("zeey_auth_role");
  const name = localStorage.getItem("zeey_auth_user") || (role === "owner" ? "Super Admin" : "Admin");
  let accesses: string[] = [];
  try {
    accesses = JSON.parse(localStorage.getItem("zeey_auth_access") || "[]");
  } catch {
    accesses = [];
  }
  return { role, name, accesses };
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`${small ? "w-7 h-7 rounded-lg" : "w-9 h-9 rounded-xl"} bg-brand text-white flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0`}>
      <svg className={small ? "w-4 h-4" : "w-5 h-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    </span>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span className={`${size === "sm" ? "w-8 h-8 text-xs" : "w-9 h-9 text-sm"} rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-violet-500 text-white font-bold flex items-center justify-center ring-2 ring-surface shrink-0`}>
      {name.charAt(0).toUpperCase() || "U"}
    </span>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // Sesi dibaca di efek (BUKAN saat render): localStorage tidak ada di server,
  // membacanya saat render membuat hasil server ≠ klien (hydration mismatch).
  const [session, setSession] = useState<ReturnType<typeof readSession> | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const s = readSession();
    if (!s.role) router.push("/");
    else setSession(s);
  }, [router]);

  // Kembali ke atas setiap pindah halaman (kerangka tetap, area isi yang digulir)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setIsOpen(false);
  }, [pathname]);

  if (!session?.role) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent/25 border-t-accent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-foreground/60">Memuat sesi Anda...</p>
      </div>
    );
  }

  const role = session.role;
  const userName = session.name;
  const navItems: NavModule[] = role === "owner" ? NAV_MODULES : NAV_MODULES.filter((m) => m.id === "dashboard" || session.accesses.includes(m.id));
  const current = moduleForPath(pathname);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.removeItem("zeey_auth_role");
    localStorage.removeItem("zeey_auth_access");
    localStorage.removeItem("zeey_auth_user");

    // Keluar akun tidak boleh pernah gagal: apa pun yang terjadi pada Firebase,
    // sesi lokal sudah dibersihkan di atas dan pengguna tetap diantar ke halaman
    // login. (Modul Firebase diimpor statis — memuatnya saat tombol ditekan
    // bisa gagal dengan ChunkLoadError setelah aplikasi diperbarui.)
    try {
      await signOut(auth);
      // Bersihkan sisa sesi di browser agar akun berikutnya tidak mewarisi
      // keadaan yang membuat koneksi Firestore gagal
      await clearFirebaseBrowserState();
    } catch (err) {
      console.error("Gagal mengakhiri sesi Firebase:", err);
    }
    router.push("/");
  };

  return (
    <NotificationProvider enabled={pathname === "/dashboard"}>
      <div className="flex min-h-screen text-foreground font-sans">
        {/* Header HP — kaca buram, judul halaman aktif */}
        <header className="md:hidden fixed top-0 inset-x-0 h-12 pt-[env(safe-area-inset-top)] box-content bg-surface/75 backdrop-blur-xl border-b border-border/60 flex items-center justify-between px-3.5 z-[60]">
          <div className="flex items-center gap-2 min-w-0">
            <BrandMark small />
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">Zeey Studio</p>
              <p className="text-sm font-bold truncate">{current?.name || "Dasbor"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center text-foreground/70 hover:text-accent rounded-full hover:bg-accent/10 transition-colors cursor-pointer press"
              aria-label={theme === "dark" ? "Mode terang" : "Mode gelap"}
            >
              <Icon d={theme === "dark" ? SUN : MOON} />
            </button>
            <button onClick={() => setIsOpen(true)} className="cursor-pointer press" aria-label="Profil & menu">
              <Avatar name={userName} size="sm" />
            </button>
          </div>
        </header>

        {/* Latar laci HP */}
        <div
          className={`md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[65] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setIsOpen(false)}
        />

        {/* Sidebar */}
        <aside
          className={`fixed md:sticky top-0 left-0 z-[70] md:z-50 h-[100dvh] md:h-screen w-[78vw] max-w-[280px] md:w-[248px] lg:w-[264px] md:max-w-none pb-[env(safe-area-inset-bottom)] md:pb-0
            bg-surface/90 md:bg-surface/70 backdrop-blur-xl border-r border-border/60 flex flex-col
            transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"}`}
        >
          {/* Merek */}
          <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
            <BrandMark />
            <div className="leading-tight">
              <p className="font-extrabold text-lg tracking-tight">
                Zeey <span className="text-brand">Studio</span>
              </p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-foreground/40">Studio Manager</p>
            </div>
          </div>

          {/* Navigasi */}
          <nav className="flex-1 px-3 pb-4 space-y-1 overflow-y-auto hide-scrollbar">
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-foreground/40 uppercase tracking-widest">Menu</p>
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`group relative flex items-center gap-3 px-2.5 py-2 rounded-2xl text-sm transition-all duration-200 ${
                    active ? "bg-surface shadow-md font-semibold text-foreground" : "text-foreground/65 hover:text-foreground hover:bg-surface-alt/80 font-medium"
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                      active ? `${item.gradient} text-white shadow-lg ${item.glow} scale-105` : `${item.tint} group-hover:scale-110`
                    }`}
                  >
                    <Icon d={item.icon} className="w-4 h-4" strokeWidth={2.2} />
                  </span>
                  <span className="truncate">{item.name}</span>
                  {active && <span className={`ml-auto w-1.5 h-1.5 rounded-full ${item.gradient}`} />}
                </Link>
              );
            })}
          </nav>

          {/* Profil & aksi */}
          <div className="p-3 border-t border-border/60">
            <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-surface-alt/70">
              <Avatar name={userName} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{userName}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">{role}</p>
              </div>
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-foreground/55 hover:text-accent hover:bg-surface transition-colors cursor-pointer press"
                aria-label={theme === "dark" ? "Mode terang" : "Mode gelap"}
                title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
              >
                <Icon d={theme === "dark" ? SUN : MOON} className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-foreground/55 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer press"
                aria-label="Keluar Akun"
                title="Keluar Akun"
              >
                <Icon d={LOGOUT} className="w-4 h-4" />
                <span className="sr-only">Keluar Akun</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Isi halaman */}
        <main
          ref={mainRef}
          className="flex-1 flex flex-col min-w-0 md:pt-0 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 h-[100dvh] md:h-screen overflow-y-auto overscroll-contain"
        >
          <div key={pathname} className="page-enter flex-1 flex flex-col min-w-0">
            {children}
          </div>
        </main>

        {/* Bilah navigasi bawah (HP) */}
        <BottomNav navItems={navItems} pathname={pathname} isMenuOpen={isOpen} onMenu={() => setIsOpen((v) => !v)} />
      </div>
    </NotificationProvider>
  );
}
