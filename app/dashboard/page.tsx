"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';
import { db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";

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
        const snapshot = await getDocs(q);
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
        
        fetchedProjects.forEach((p) => {
          if (p.status === 'Selesai' || p.status === 'File Terkirim' || p.status === 'Lunas') {
            completed++;
            if (p.packagePrice) revenue += p.packagePrice;
            if (p.extraRevenue) revenue += p.extraRevenue;
          } else {
            active++;
            if (p.dpAmount) revenue += p.dpAmount; // DP dari proyek aktif tetap dihitung
          }
        });
        
        setActiveProjectsCount(active);
        setCompletedProjectsCount(completed);
        setTotalRevenue(revenue);

        // Ambil data Editor
        const reqSnapshot = await getDocs(query(collection(db, "editor_requests")));
        let editorCount = 0;
        reqSnapshot.forEach(doc => {
          if (doc.data().status === 'Selesai') editorCount++;
        });
        setCompletedEditorTasks(editorCount);
        
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
          const createdDate = new Date(p.createdAt);
          const createdKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
          const cMonth = last6Months.find(m => m.key === createdKey);
          if (cMonth) cMonth.proyek += 1;
          
          let pRev = 0;
          if (p.status === 'Selesai' || p.status === 'File Terkirim' || p.status === 'Lunas') {
            if (p.packagePrice) pRev += p.packagePrice;
            if (p.extraRevenue) pRev += p.extraRevenue;
          } else {
             if (p.dpAmount) pRev += p.dpAmount;
          }

          if (pRev > 0) {
            const compDate = p.completedAt ? new Date(p.completedAt) : new Date(p.createdAt);
            const compKey = `${compDate.getFullYear()}-${String(compDate.getMonth() + 1).padStart(2, '0')}`;
            const rMonth = last6Months.find(m => m.key === compKey);
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

  return (
    <Sidebar>
      <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full pb-24 space-y-8 animate-in fade-in duration-500">
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
            <p className="mt-4 text-foreground/50 font-sans animate-pulse">Memuat dasbor...</p>
          </div>
        ) : userRole === 'admin' ? (
          /* ========================================= */
          /* ADMIN DASHBOARD VIEW                      */
          /* ========================================= */
          <div className="space-y-10">
            <div className="bg-gradient-to-r from-surface to-surface-alt border border-border p-8 md:p-10 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="absolute -right-10 -top-10 text-accent/5">
                <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </div>
              <div className="relative z-10">
                <h1 className="text-3xl md:text-5xl font-serif text-foreground mb-4">Halo, {userName}!</h1>
                <p className="text-foreground/70 font-sans text-base md:text-lg max-w-xl">
                  Selamat datang kembali di dasbor kerja Anda. Berikut adalah ringkasan tugas dan proyek yang saat ini menjadi tanggung jawab Anda.
                </p>
              </div>
            </div>

            <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 gap-4 sm:gap-6 snap-x hide-scrollbar">
              <div className="min-w-[85vw] sm:min-w-0 bg-surface border border-border p-6 sm:p-8 rounded-3xl shadow-sm hover:shadow-md transition-all flex items-center justify-between snap-center">
                <div>
                  <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Tugas / Proyek Aktif</p>
                  <h2 className="text-4xl md:text-5xl font-serif text-amber-500">{activeProjectsCount}</h2>
                  <p className="text-sm text-foreground/50 mt-2 font-sans">Sedang berjalan</p>
                </div>
                <div className="p-4 bg-amber-500/10 rounded-full text-amber-500">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>
              
              <div className="min-w-[85vw] sm:min-w-0 bg-surface border border-border p-6 sm:p-8 rounded-3xl shadow-sm hover:shadow-md transition-all flex items-center justify-between snap-center">
                <div>
                  <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Proyek Selesai</p>
                  <h2 className="text-4xl md:text-5xl font-serif text-emerald-500">{completedProjectsCount}</h2>
                  <p className="text-sm text-foreground/50 mt-2 font-sans">Berhasil diselesaikan</p>
                </div>
                <div className="p-4 bg-emerald-500/10 rounded-full text-emerald-500">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
              </div>
            </div>

            {userAccess.length > 0 && (
              <div>
                <h3 className="text-xl font-serif mb-4 sm:mb-6 sm:border-b border-border/50 sm:pb-4">Akses Cepat Modul Anda</h3>
                <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 gap-3 sm:gap-4 snap-x hide-scrollbar">
                  {userAccess.includes('create') && (
                    <Link href="/dashboard/create" className="min-w-[40vw] sm:min-w-0 bg-surface border border-border p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-accent/50 transition-all text-center group cursor-pointer snap-center">
                      <div className="w-12 h-12 mx-auto bg-accent/10 text-accent rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                      </div>
                      <h4 className="font-medium text-foreground text-sm">Buat Booking</h4>
                    </Link>
                  )}
                  {userAccess.includes('bookings') && (
                    <Link href="/dashboard/bookings" className="min-w-[40vw] sm:min-w-0 bg-surface border border-border p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-accent/50 transition-all text-center group cursor-pointer snap-center">
                      <div className="w-12 h-12 mx-auto bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                      </div>
                      <h4 className="font-medium text-foreground text-sm">Pesanan</h4>
                    </Link>
                  )}
                  {userAccess.includes('editor') && (
                    <Link href="/dashboard/editor" className="min-w-[40vw] sm:min-w-0 bg-surface border border-border p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-accent/50 transition-all text-center group cursor-pointer snap-center">
                      <div className="w-12 h-12 mx-auto bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      </div>
                      <h4 className="font-medium text-foreground text-sm">Tugas Editor</h4>
                    </Link>
                  )}
                  {userAccess.includes('crm') && (
                    <Link href="/dashboard/crm" className="min-w-[40vw] sm:min-w-0 bg-surface border border-border p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-accent/50 transition-all text-center group cursor-pointer snap-center">
                      <div className="w-12 h-12 mx-auto bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                      </div>
                      <h4 className="font-medium text-foreground text-sm">Data Klien</h4>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================= */
          /* OWNER DASHBOARD VIEW (Analitik)           */
          /* ========================================= */
          <>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-6">
              <div>
                <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Ringkasan Studio</h1>
                <p className="text-foreground/60 font-sans text-sm md:text-base">Dasbor Analitik Bisnis & Kinerja</p>
              </div>
              <Link
                href="/dashboard/bookings"
                className="bg-accent text-white px-6 py-3 rounded-xl font-medium hover:bg-accent-dark transition-all shadow-md text-sm text-center flex items-center justify-center gap-2 group cursor-pointer"
              >
                Kelola {activeProjectsCount} Proyek Aktif
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              </Link>
            </div>

            {/* Summary Cards */}
            <div className="flex overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 snap-x hide-scrollbar">
              <div className="min-w-[80vw] sm:min-w-0 bg-gradient-to-br from-accent to-pink-600 p-6 rounded-3xl shadow-lg text-white transform transition-transform hover:-translate-y-1 relative overflow-hidden group snap-center">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <p className="text-sm font-sans uppercase tracking-wider mb-2 opacity-90 relative z-10">Total Omzet Keseluruhan</p>
                <h2 className="text-3xl md:text-4xl font-serif relative z-10">{formatRupiah(totalRevenue)}</h2>
                <p className="text-xs mt-2 font-sans opacity-80 relative z-10">Paket Dasar & Tambahan</p>
              </div>
              
              <div className="min-w-[70vw] sm:min-w-0 bg-surface border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all snap-center">
                <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Total Proyek</p>
                <h2 className="text-3xl md:text-4xl font-serif text-foreground">{projects.length}</h2>
                <p className="text-xs text-foreground/50 mt-2 font-sans">Sepanjang waktu</p>
              </div>
              
              <div className="min-w-[70vw] sm:min-w-0 bg-surface border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all snap-center">
                <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Proyek Aktif</p>
                <h2 className="text-3xl md:text-4xl font-serif text-amber-500">{activeProjectsCount}</h2>
                <p className="text-xs text-foreground/50 mt-2 font-sans">Menunggu pemilihan klien</p>
              </div>
              
              <div className="min-w-[70vw] sm:min-w-0 bg-surface border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all snap-center">
                <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Proyek Lunas</p>
                <h2 className="text-3xl md:text-4xl font-serif text-emerald-500">{completedProjectsCount}</h2>
                <p className="text-xs text-foreground/50 mt-2 font-sans">Selesai & dibayar</p>
              </div>

              <div className="min-w-[70vw] sm:min-w-0 bg-surface border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all snap-center">
                <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Tugas Edit Selesai</p>
                <h2 className="text-3xl md:text-4xl font-serif text-purple-500">{completedEditorTasks}</h2>
                <p className="text-xs text-foreground/50 mt-2 font-sans">Kinerja tim editor</p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              
              {/* Revenue Area Chart */}
              <div className="bg-surface border border-border p-5 md:p-6 rounded-3xl shadow-sm">
                <h3 className="text-lg md:text-xl font-serif mb-6 border-b border-border/50 pb-3 flex items-center">
                  <span className="w-2 h-6 bg-accent rounded-full mr-3"></span>
                  Tren Pendapatan Ekstra (6 Bulan)
                </h3>
                <div className="h-[250px] md:h-[300px] w-full font-sans text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} dy={10} />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#9ca3af'}}
                        tickFormatter={(value) => `Rp${value / 1000}k`}
                        dx={-10}
                      />
                      <RechartsTooltip 
                        formatter={(value: any) => [formatRupiah(Number(value) || 0), "Pendapatan"]}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Project Bar Chart */}
              <div className="bg-surface border border-border p-5 md:p-6 rounded-3xl shadow-sm">
                <h3 className="text-lg md:text-xl font-serif mb-6 border-b border-border/50 pb-3 flex items-center">
                  <span className="w-2 h-6 bg-blue-500 rounded-full mr-3"></span>
                  Tren Klien Baru (6 Bulan)
                </h3>
                <div className="h-[250px] md:h-[300px] w-full font-sans text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} dy={10} />
                      <YAxis 
                        allowDecimals={false}
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#9ca3af'}}
                      />
                      <RechartsTooltip 
                        formatter={(value: any) => [Number(value) || 0, "Proyek Baru"]}
                        cursor={{fill: '#f9fafb'}}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #f3f4f6', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      />
                      <Bar dataKey="proyek" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Sidebar>
  );
}
