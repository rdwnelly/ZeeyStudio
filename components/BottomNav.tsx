"use client";

import Link from "next/link";
import { Icon } from "./ui";
import { isActivePath, type NavModule } from "@/lib/nav-modules";

export type NavItem = NavModule;

/** Urutan prioritas modul yang ditampilkan langsung di bilah bawah. */
const PRIORITY = ["bookings", "finance", "editor", "crm", "audit", "settings"];

const MENU_ICON = "M4 6h16M4 12h10M4 18h16";

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
  navItems: NavModule[];
  pathname: string;
  isMenuOpen: boolean;
  onMenu: () => void;
}) {
  const byId = new Map(navItems.map((i) => [i.id as string, i]));
  const home = byId.get("dashboard");
  const create = byId.get("create");
  const sides = PRIORITY.map((id) => byId.get(id)).filter((i): i is NavModule => !!i).slice(0, create ? 2 : 3);

  // Susunan slot: Beranda, sisi-1, [Buat], sisi-2, (sisi-3 bila tanpa Buat), Menu
  const slots: Array<NavModule | "create"> = [];
  if (home) slots.push(home);
  if (sides[0]) slots.push(sides[0]);
  if (create) slots.push("create");
  slots.push(...sides.slice(1));

  const shownHrefs = [home, create, ...sides].filter(Boolean).map((i) => i!.href);
  const menuActive = isMenuOpen || !shownHrefs.some((h) => isActivePath(pathname, h));

  const tab = (key: string, active: boolean, iconD: string, label: string, tint: string) => (
    <>
      <span
        className={`relative flex items-center justify-center h-7 w-12 rounded-full transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          active ? `${tint} scale-100` : "scale-90"
        }`}
      >
        <Icon d={iconD} className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} />
      </span>
      <span key={key} className={`text-[10px] leading-none transition-colors ${active ? "font-bold text-foreground" : "font-medium"}`}>
        {label}
      </span>
    </>
  );

  return (
    <nav
      aria-label="Navigasi utama"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/80 backdrop-blur-xl border-t border-border/60 shadow-[0_-8px_30px_-12px_rgba(79,70,229,0.18)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around h-[3.6rem] px-1">
        {slots.map((slot) => {
          if (slot === "create" && create) {
            const active = isActivePath(pathname, create.href);
            return (
              <li key="create" className="flex-1 flex justify-center">
                <Link href={create.href} aria-label={create.name} aria-current={active ? "page" : undefined} className="-mt-5 flex flex-col items-center gap-1 press">
                  <span
                    className={`w-[3.25rem] h-[3.25rem] rounded-2xl bg-brand flex items-center justify-center text-white shadow-xl shadow-violet-500/40 ring-4 ring-background transition-transform duration-300 ${
                      active ? "scale-105" : ""
                    }`}
                  >
                    <Icon d={create.icon} className="w-6 h-6" strokeWidth={2.6} />
                  </span>
                  <span className={`text-[10px] leading-none ${active ? "font-bold text-foreground" : "font-medium text-foreground/55"}`}>{create.short}</span>
                </Link>
              </li>
            );
          }
          const item = slot as NavModule;
          const active = !isMenuOpen && isActivePath(pathname, item.href);
          return (
            <li key={item.id} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`h-full flex flex-col items-center justify-center gap-1 press ${active ? "" : "text-foreground/50"}`}
              >
                {tab(item.id, active, item.icon, item.short, item.tint)}
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
            className={`w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer press ${menuActive ? "" : "text-foreground/50"}`}
          >
            {tab("menu", menuActive, MENU_ICON, "Menu", "text-accent bg-accent/12")}
          </button>
        </li>
      </ul>
    </nav>
  );
}
