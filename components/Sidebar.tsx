"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { NotificationProvider } from "./NotificationProvider";

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAccesses, setUserAccesses] = useState<string[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const authRole = localStorage.getItem("zeey_auth_role");
    const authUser = localStorage.getItem("zeey_auth_user");
    const authAccessStr = localStorage.getItem("zeey_auth_access");
    if (!authRole) {
      router.push("/");
    } else {
      setRole(authRole);
      setUserName(authUser || (authRole === "owner" ? "Super Admin" : "Admin"));
      if (authAccessStr) {
        try {
          setUserAccesses(JSON.parse(authAccessStr));
        } catch (e) {
          setUserAccesses([]);
        }
      }
    }
  }, [router]);

  if (!role) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-sans text-foreground/60">Memuat sesi Anda...</p>
      </div>
    );
  }

  const ALL_MODULES = [
    { id: "dashboard", name: "Ringkasan", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { id: "create", name: "Buat Project Baru", href: "/dashboard/create", icon: "M12 6v6m0 0v6m0-6h6m-6 0H6" },
    { id: "bookings", name: "Daftar Pesanan", href: "/dashboard/bookings", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
    { id: "editor", name: "Tugas Editor", href: "/dashboard/editor", icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
    { id: "finance", name: "Keuangan & Bisnis", href: "/dashboard/finance", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { id: "crm", name: "Data Klien (CRM)", href: "/dashboard/crm", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    { id: "audit", name: "Riwayat Aktivitas", href: "/dashboard/audit", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    { id: "settings", name: "Pengaturan", href: "/dashboard/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  ];

  const navItems = role === "owner" ? ALL_MODULES : ALL_MODULES.filter(item => userAccesses.includes(item.id));

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    localStorage.removeItem("zeey_auth_role");
    localStorage.removeItem("zeey_auth_access");
    localStorage.removeItem("zeey_auth_user");
    router.push("/");
  };

  return (
    <NotificationProvider>
      <div className="flex min-h-screen bg-background text-foreground font-sans selection:bg-accent/30">
        {/* Mobile Header (Glassmorphism) */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-4 z-[60] shadow-sm">
          <div className="font-bold text-xl font-serif">Zeey Studio</div>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-foreground/80 hover:text-accent transition-colors cursor-pointer rounded-full hover:bg-accent/10"
            aria-label="Toggle Menu"
          >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-all duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed md:sticky top-0 left-0 z-50 h-screen w-[280px] bg-surface border-r border-border flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-[4px_0_24px_rgba(0,0,0,0.02)]
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Brand & User Profile */}
        <div className="flex flex-col justify-center px-6 pt-8 pb-6 border-b border-border/50">
          <div className="font-bold text-2xl font-serif text-accent mb-6 flex items-center gap-2">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
              <circle cx="12" cy="13" r="3"></circle>
            </svg>
            Zeey Studio
          </div>
          <div className="bg-background rounded-xl p-4 border border-border shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-accent font-bold text-lg">
              {userName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate text-foreground">{userName}</p>
              <p className="text-xs text-foreground/50 uppercase tracking-widest font-medium mt-0.5">{role}</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto hide-scrollbar">
          <div className="px-3 mb-2 text-xs font-semibold text-foreground/40 uppercase tracking-widest">Menu Utama</div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const isReallyActive = item.href === "/dashboard" ? pathname === "/dashboard" : isActive;
            
            return (
              <Link 
                key={item.name} 
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative
                  ${isReallyActive 
                    ? "text-accent bg-accent/10" 
                    : "text-foreground/70 hover:bg-surface-alt hover:text-foreground"}
                `}
              >
                {isReallyActive && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-accent rounded-r-full" />
                )}
                <svg className={`w-5 h-5 mr-3 transition-colors ${isReallyActive ? "text-accent" : "text-foreground/40 group-hover:text-foreground/70"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                </svg>
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        {/* Theme Toggle & Logout */}
        <div className="p-4 border-t border-border/50 flex flex-col gap-2">
          <button 
            onClick={toggleTheme}
            className="flex w-full items-center px-4 py-3 text-sm font-medium text-foreground/60 rounded-xl hover:bg-surface-alt hover:text-foreground transition-all cursor-pointer group"
          >
            {theme === 'dark' ? (
              <>
                <svg className="w-5 h-5 mr-3 text-foreground/40 group-hover:text-foreground transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                Mode Terang
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-3 text-foreground/40 group-hover:text-foreground transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                Mode Gelap
              </>
            )}
          </button>
          <button 
            onClick={handleLogout}
            className="flex w-full items-center px-4 py-3 text-sm font-medium text-foreground/60 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all cursor-pointer group"
          >
            <svg className="w-5 h-5 mr-3 text-foreground/40 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Keluar Akun
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pt-0 pt-16 h-screen overflow-y-auto bg-background/50">
        {children}
      </div>
    </div>
    </NotificationProvider>
  );
}
