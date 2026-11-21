"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';
import { db } from "@/lib/firebase";
import { collection, query } from "firebase/firestore";
import { getDocsFresh } from "@/lib/firestore-fetch";
import { isPaidProject, projectRevenue, revenueDate, monthKey } from "@/lib/revenue";
import { Icon, PageHeader, SkeletonBlock, StatCard } from "@/components/ui";
import { NAV_MODULES } from "@/lib/nav-modules";

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-pink-500 to-rose-500",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-purple-500 to-fuchsia-500",
];

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  maxPhotos: number;
  createdAt: string;
  status?: string;
  extraRevenue?: number;
  packagePrice?: number;
  dpAmount?: number;
  completedAt?: string;
  createdBy?: string;
  assignedAdmin?: string;
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default function DashboardHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [completedProjectsCount, setCompletedProjectsCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [completedEditorTasks, setCompletedEditorTasks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [userRole, setUserRole] = useState('');
  const [userName, setUserName] = useState('');
  const [userAccess, setUserAccess] = useState<string[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const q = query(collection(db, "projects"));
        // Bila koneksi belum siap, hitung ulang begitu data server menyusul
        const { snapshot } = await getDocsFresh(q, () => { void fetchStats(); });
        let fetchedProjects: Project[] = [];
        snapshot.forEach(doc => {
          fetchedProjects.push({ id: doc.id, ...doc.data() } as Project);
        });

        const role = localStorage.getItem("zeey_auth_role") || "";
        const name = localStorage.getItem("zeey_auth_user") || "";
        let access: string[] = [];
        try {
          const accStr = localStorage.getItem("zeey_auth_access");
          if (accStr) access = JSON.parse(accStr);
        } catch (e) {}

        setUserRole(role);
        setUserName(name);
        setUserAccess(access);

        if (role === 'admin') {
          fetchedProjects = fetchedProjects.filter(p => p.assignedAdmin === name || p.createdBy === name);
        }

        setProjects(fetchedProjects);
        
        let active = 0;
        let completed = 0;
        let revenue = 0;

        // Rumus pendapatan seragam dengan modul Keuangan (lib/revenue.ts)
        fetchedProjects.forEach((p) => {
          if (isPaidProject(p)) completed++;
          else active++;
          revenue += projectRevenue(p);
        });

        setActiveProjectsCount(active);
        setCompletedProjectsCount(completed);
        setTotalRevenue(revenue);

        // Ambil data Editor
        // editor_requests hanya dapat dibaca Owner / admin berakses Tugas Editor
        if (role === 'owner' || access.includes('editor')) {
          const { snapshot: reqSnapshot } = await getDocsFresh(query(collection(db, "editor_requests")));
          let editorCount = 0;
          reqSnapshot.forEach(doc => {
            if (doc.data().status === 'Selesai') editorCount++;
          });
          setCompletedEditorTasks(editorCount);
        }
        
        // Prepare Chart Data (Last 6 Months)
        const last6Months: Array<{ key: string, label: string, revenue: number, proyek: number }> = [];
        const d = new Date();
        for (let i = 5; i >= 0; i--) {
          const month = new Date(d.getFullYear(), d.getMonth() - i, 1);
          const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
          last6Months.push({
            key,
            label: `${monthNames[month.getMonth()]}`,
            revenue: 0,
            proyek: 0
          });
        }

        fetchedProjects.forEach((p) => {
          const cMonth = last6Months.find(m => m.key === monthKey(new Date(p.createdAt)));
          if (cMonth) cMonth.proyek += 1;

          const pRev = projectRevenue(p);
          if (pRev > 0) {
            const rMonth = last6Months.find(m => m.key === monthKey(revenueDate(p)));
            if (rMonth) rMonth.revenue += pRev;
          }
        });

        setChartData(last6Months);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  const quickModules = NAV_MODULES.filter((m) => m.id !== 'dashboard' && userAccess.includes(m.id));

  const chartTooltip = {
    contentStyle: {
      borderRadius: 14,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      color: 'var(--foreground)',
      boxShadow: '0 12px 32px -8px rgba(79,70,229,0.25)',
      fontSize: 12,
    },
    labelStyle: { color: 'var(--foreground)', fontWeight: 600 },
  };

  return (
    <Sidebar>
      <div className="p-3.5 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-8 space-y-5 md:space-y-6">
        {isLoading ? (
          <div className="space-y-5">
            <SkeletonBlock className="h-14 w-64" />
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
              {[0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className={`h-28 ${i === 0 ? 'col-span-2' : ''}`} />)}
            </div>
            <div className="grid lg:grid-cols-5 gap-4">
              <SkeletonBlock className="h-72 lg:col-span-3" />
              <SkeletonBlock className="h-72 lg:col-span-2" />
            </div>
          </div>
        ) : userRole === 'admin' ? (
          /* ── Dasbor Admin ─────────────────────────────────────── */
          <>
            <section className="relative overflow-hidden rounded-3xl bg-aurora p-5 md:p-8 text-white shadow-xl shadow-violet-500/25 animate-in fade-in zoom-in-95 duration-500">
              <div className="absolute -right-10 -top-12 w-48 h-48 rounded-full bg-white/15 blur-2xl animate-float" />
              <div className="absolute right-16 -bottom-16 w-40 h-40 rounded-full bg-amber-300/30 blur-2xl animate-float [animation-delay:-4s]" />
              <p className="relative text-xs font-semibold uppercase tracking-widest text-white/80">{today}</p>
              <h1 className="relative mt-1 text-2xl md:text-4xl font-extrabold tracking-tight">Halo, {userName}! 👋</h1>
              <p className="relative mt-2 text-sm md:text-base text-white/85 max-w-xl">Ringkasan tugas dan proyek yang menjadi tanggung jawab Anda hari ini.</p>
            </section>

            <div className="grid grid-cols-2 gap-3 md:gap-4 stagger">
              <StatCard label="Proyek Aktif" value={activeProjectsCount} hint="Sedang berjalan" tone="amber" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              <StatCard label="Proyek Selesai" value={completedProjectsCount} hint="Berhasil diselesaikan" tone="emerald" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </div>

            {quickModules.length > 0 && (
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/50 mb-3">Akses Cepat</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
                  {quickModules.map((m) => (
                    <Link key={m.id} href={m.href} className="group rounded-3xl bg-surface border border-border/70 p-4 shadow-sm lift press flex flex-col items-start gap-3">
                      <span className={`w-11 h-11 rounded-2xl ${m.gradient} shadow-lg ${m.glow} text-white flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
                        <Icon d={m.icon} className="w-5 h-5" strokeWidth={2.2} />
                      </span>
                      <span className="text-sm font-semibold">{m.name}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          /* ── Dasbor Owner (Analitik) ──────────────────────────── */
          <>
            <PageHeader
              module="dashboard"
              title="Ringkasan Studio"
              subtitle={`Analitik bisnis & kinerja · ${today}`}
              actions={
                <Link
                  href="/dashboard/bookings"
                  className="group bg-brand text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2 press hover:brightness-110 transition"
                >
                  Kelola {activeProjectsCount} Proyek Aktif
                  <Icon d="M14 5l7 7m0 0l-7 7m7-7H3" className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              }
            />

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4 stagger">
              <div className="col-span-2">
                <StatCard highlight label="Total Omzet" value={totalRevenue} format={(n) => formatRupiah(Math.round(n))} hint="Paket dasar & tambahan" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </div>
              <StatCard label="Total Proyek" value={projects.length} hint="Sepanjang waktu" tone="sky" icon="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              <StatCard label="Proyek Aktif" value={activeProjectsCount} hint="Menunggu klien" tone="amber" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              <StatCard label="Proyek Lunas" value={completedProjectsCount} hint="Selesai & dibayar" tone="emerald" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              <StatCard label="Edit Selesai" value={completedEditorTasks} hint="Kinerja tim editor" tone="fuchsia" icon="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5 stagger">
              <section className="lg:col-span-3 rounded-3xl bg-surface border border-border/70 p-4 md:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm md:text-base font-bold">Tren Pendapatan</h3>
                    <p className="text-[11px] text-foreground/50">6 bulan terakhir</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">Rupiah</span>
                </div>
                <div className="h-[220px] md:h-[280px] w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revStroke" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="55%" stopColor="#a855f7" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.5 }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} width={44} tick={{ fill: 'currentColor', opacity: 0.5 }} tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(v % 1e6 ? 1 : 0)}jt` : `${v / 1000}rb`)} />
                      <RechartsTooltip formatter={(value: any) => [formatRupiah(Number(value) || 0), "Pendapatan"]} {...chartTooltip} />
                      <Area type="monotone" dataKey="revenue" stroke="url(#revStroke)" strokeWidth={3} fill="url(#revFill)" animationDuration={1200} activeDot={{ r: 5, fill: '#a855f7', stroke: 'var(--surface)', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="lg:col-span-2 rounded-3xl bg-surface border border-border/70 p-4 md:p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm md:text-base font-bold">Klien Baru</h3>
                    <p className="text-[11px] text-foreground/50">Proyek per bulan</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">Proyek</span>
                </div>
                <div className="h-[220px] md:h-[280px] w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 6, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.5 }} dy={8} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.5 }} />
                      <RechartsTooltip formatter={(value: any) => [Number(value) || 0, "Proyek Baru"]} cursor={{ fill: 'rgba(99,102,241,0.08)', radius: 8 }} {...chartTooltip} />
                      <Bar dataKey="proyek" fill="url(#barFill)" radius={[8, 8, 8, 8]} barSize={22} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            {recentProjects.length > 0 && (
              <section className="rounded-3xl bg-surface border border-border/70 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500">
                <div className="flex items-center justify-between px-4 md:px-5 pt-4 pb-2">
                  <h3 className="text-sm md:text-base font-bold">Proyek Terbaru</h3>
                  <Link href="/dashboard/bookings" className="text-xs font-semibold text-accent hover:underline">Lihat semua</Link>
                </div>
                <ul className="divide-y divide-border/60 stagger">
                  {recentProjects.map((p) => {
                    const paid = isPaidProject(p);
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-4 md:px-5 py-3 hover:bg-surface-alt/50 transition-colors">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 bg-gradient-to-br ${AVATAR_GRADIENTS[(p.clientName || '?').charCodeAt(0) % AVATAR_GRADIENTS.length]}`}>
                          {(p.clientName || '?').charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{p.clientName}</p>
                          <p className="text-[11px] text-foreground/50">{new Date(p.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <span className={`text-[10px] md:text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${paid ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
                          {p.status || 'Aktif'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </Sidebar>
  );
}
