/**
 * Daftar modul dasbor — satu sumber untuk Sidebar, bilah navigasi bawah, dan header halaman.
 * Setiap modul punya warna gradasi sendiri agar tampilan penuh warna tetapi tetap konsisten.
 */
export type ModuleId = "dashboard" | "create" | "bookings" | "editor" | "finance" | "crm" | "audit" | "settings";

export type NavModule = {
  id: ModuleId;
  name: string;
  short: string; // label pendek untuk bilah bawah HP
  href: string;
  icon: string; // path SVG (stroke, viewBox 0 0 24 24)
  gradient: string; // kelas gradasi Tailwind (bg-gradient-to-br + from/to)
  tint: string; // warna ikon & latar lembut saat tidak aktif
  glow: string; // bayangan berwarna untuk ikon aktif
};

export const NAV_MODULES: NavModule[] = [
  {
    id: "dashboard",
    name: "Dasbor Utama",
    short: "Beranda",
    href: "/dashboard",
    icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z",
    gradient: "bg-gradient-to-br from-indigo-500 to-violet-500",
    tint: "text-indigo-500 bg-indigo-500/10",
    glow: "shadow-indigo-500/30",
  },
  {
    id: "create",
    name: "Buat Project Baru",
    short: "Buat",
    href: "/dashboard/create",
    icon: "M12 5v14m-7-7h14",
    gradient: "bg-gradient-to-br from-pink-500 to-rose-500",
    tint: "text-pink-500 bg-pink-500/10",
    glow: "shadow-pink-500/30",
  },
  {
    id: "bookings",
    name: "Daftar Pesanan",
    short: "Pesanan",
    href: "/dashboard/bookings",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    gradient: "bg-gradient-to-br from-sky-500 to-blue-600",
    tint: "text-sky-500 bg-sky-500/10",
    glow: "shadow-sky-500/30",
  },
  {
    id: "editor",
    name: "Tugas Editor",
    short: "Editor",
    href: "/dashboard/editor",
    icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
    gradient: "bg-gradient-to-br from-purple-500 to-fuchsia-500",
    tint: "text-fuchsia-500 bg-fuchsia-500/10",
    glow: "shadow-fuchsia-500/30",
  },
  {
    id: "finance",
    name: "Keuangan & Bisnis",
    short: "Keuangan",
    href: "/dashboard/finance",
    icon: "M3 17l6-6 4 4 8-8m0 0v6m0-6h-6",
    gradient: "bg-gradient-to-br from-emerald-500 to-teal-500",
    tint: "text-emerald-500 bg-emerald-500/10",
    glow: "shadow-emerald-500/30",
  },
  {
    id: "crm",
    name: "Data Klien (CRM)",
    short: "Klien",
    href: "/dashboard/crm",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    gradient: "bg-gradient-to-br from-amber-400 to-orange-500",
    tint: "text-amber-500 bg-amber-500/10",
    glow: "shadow-amber-500/30",
  },
  {
    id: "audit",
    name: "Riwayat Aktivitas",
    short: "Riwayat",
    href: "/dashboard/audit",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    gradient: "bg-gradient-to-br from-cyan-500 to-teal-600",
    tint: "text-cyan-500 bg-cyan-500/10",
    glow: "shadow-cyan-500/30",
  },
  {
    id: "settings",
    name: "Pengaturan",
    short: "Atur",
    href: "/dashboard/settings",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    gradient: "bg-gradient-to-br from-slate-500 to-slate-700",
    tint: "text-slate-500 bg-slate-500/10",
    glow: "shadow-slate-500/30",
  },
];

export const MODULE_BY_ID = Object.fromEntries(NAV_MODULES.map((m) => [m.id, m])) as Record<ModuleId, NavModule>;

export function isActivePath(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(href + "/");
}

export function moduleForPath(pathname: string): NavModule | undefined {
  return NAV_MODULES.find((m) => m.href !== "/dashboard" && isActivePath(pathname, m.href)) || (pathname === "/dashboard" ? MODULE_BY_ID.dashboard : undefined);
}
