"use client";

import Link from "next/link";

export type NavItem = { id: string; name: string; href: string; icon: string };

/** Label pendek untuk bilah navigasi bawah (ruang terbatas di layar HP). */
const SHORT_LABEL: Record<string, string> = {
  dashboard: "Beranda",
  create: "Buat",
  bookings: "Pesanan",
  editor: "Editor",
  finance: "Keuangan",
  crm: "Klien",
  audit: "Riwayat",
  settings: "Atur",
};

/** Urutan prioritas modul yang ditampilkan langsung di bilah bawah. */
const PRIORITY = ["bookings", "finance", "editor", "crm", "audit", "settings"];

const MENU_ICON = "M4 6h16M4 12h16M4 18h16";

function isActivePath(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(href + "/");
}

/**
 * Bilah navigasi bawah (khusus layar HP, < 768px).
 * Maks. 5 slot: Beranda · modul utama · [Buat di tengah] · modul utama · Menu.
 * Modul lain tetap dapat dibuka lewat "Menu" (laci samping).
 */
export default function BottomNav({
  navItems,
  pathname,
  isMenuOpen,
  onMenu,
}: {
  navItems: NavItem[];
  pathname: string;
  isMenuOpen: boolean;
  onMenu: () => void;
}) {
  const byId = new Map(navItems.map((i) => [i.id, i]));
  const home = byId.get("dashboard");
  const create = byId.get("create");
  const sides = PRIORITY.map((id) => byId.get(id)).filter((i): i is NavItem => !!i).slice(0, create ? 2 : 3);

  // Susunan slot: Beranda, sisi-1, [Buat], sisi-2, (sisi-3 bila tanpa Buat), Menu
  const slots: Array<NavItem | "create"> = [];
  if (home) slots.push(home);
  if (sides[0]) slots.push(sides[0]);
  if (create) slots.push("create");
  slots.push(...sides.slice(1));

  const shownHrefs = [home, create, ...sides].filter(Boolean).map((i) => i!.href);
  const menuActive = isMenuOpen || !shownHrefs.some((h) => isActivePath(pathname, h));

  return (
    <nav
      aria-label="Navigasi utama"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around h-14 px-1">
        {slots.map((slot) => {
          if (slot === "create" && create) {
            const active = isActivePath(pathname, create.href);
            return (
              <li key="create" className="flex-1 flex justify-center">
                <Link
                  href={create.href}
                  aria-label={create.name}
                  aria-current={active ? "page" : undefined}
                  className="-mt-5 flex flex-col items-center gap-0.5"
                >
                  <span
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg shadow-accent/30 ring-4 ring-background transition-transform active:scale-95 ${
                      active ? "bg-accent-dark" : "bg-accent"
                    }`}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={create.icon} />
                    </svg>
                  </span>
                  <span className={`text-[10px] font-medium leading-none ${active ? "text-accent" : "text-foreground/60"}`}>
                    {SHORT_LABEL.create}
                  </span>
                </Link>
              </li>
            );
          }
          const item = slot as NavItem;
          const active = !isMenuOpen && isActivePath(pathname, item.href);
          return (
            <li key={item.id} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative h-full flex flex-col items-center justify-center gap-1 transition-colors active:scale-95 ${
                  active ? "text-accent" : "text-foreground/55"
                }`}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-accent" />}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.25 : 1.75} d={item.icon} />
                </svg>
                <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}>
                  {SHORT_LABEL[item.id] || item.name}
                </span>
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={onMenu}
            aria-expanded={isMenuOpen}
            aria-label="Buka menu lainnya"
            className={`relative w-full h-full flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer active:scale-95 ${
              menuActive ? "text-accent" : "text-foreground/55"
            }`}
          >
            {menuActive && <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-accent" />}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={menuActive ? 2.25 : 1.75} d={MENU_ICON} />
            </svg>
            <span className={`text-[10px] leading-none ${menuActive ? "font-semibold" : "font-medium"}`}>Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
