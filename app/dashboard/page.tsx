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
  status?: 'Menunggu Pemilihan' | 'Selesai';
  extraRevenue?: number;
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
  const [isLoading, setIsLoading] = useState(true);
  
  const [chartData, setChartData] = useState<any[]>([]);

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

        if (role === 'admin') {
          fetchedProjects = fetchedProjects.filter(p => p.assignedAdmin === name || p.createdBy === name);
        }

        setProjects(fetchedProjects);
        
        let active = 0;
        let completed = 0;
        let revenue = 0;
        
        fetchedProjects.forEach((p) => {
          if (p.status === 'Selesai') completed++;
          else active++;
          
          if (p.extraRevenue) revenue += p.extraRevenue;
        });
        
        setActiveProjectsCount(active);
        setCompletedProjectsCount(completed);
        setTotalRevenue(revenue);
        
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
          
          if (p.status === 'Selesai' && p.extraRevenue) {
            const compDate = p.completedAt ? new Date(p.completedAt) : new Date(p.createdAt);
            const compKey = `${compDate.getFullYear()}-${String(compDate.getMonth() + 1).padStart(2, '0')}`;
            const rMonth = last6Months.find(m => m.key === compKey);
            if (rMonth) rMonth.revenue += p.extraRevenue;
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
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Ringkasan Studio</h1>
            <p className="text-foreground/60 font-sans text-sm md:text-base">Dasbor Analitik Bisnis & Kinerja</p>
          </div>
          <Link
            href="/dashboard/bookings"
            className="bg-accent text-white px-6 py-3 rounded-xl font-medium hover:bg-accent-dark transition-all shadow-md text-sm text-center flex items-center justify-center gap-2 group"
          >
            Kelola {activeProjectsCount} Proyek Aktif
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin"></div>
            <p className="mt-4 text-foreground/50 font-sans animate-pulse">Menghitung analitik...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-gradient-to-br from-accent to-pink-600 p-6 rounded-3xl shadow-lg text-white transform transition-transform hover:-translate-y-1 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <p className="text-sm font-sans uppercase tracking-wider mb-2 opacity-90 relative z-10">Total Pendapatan Ekstra</p>
                <h2 className="text-3xl md:text-4xl font-serif relative z-10">{formatRupiah(totalRevenue)}</h2>
                <p className="text-xs mt-2 font-sans opacity-80 relative z-10">Dari biaya foto tambahan</p>
              </div>
              
              <div className="bg-surface border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all">
                <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Total Proyek</p>
                <h2 className="text-3xl md:text-4xl font-serif text-foreground">{projects.length}</h2>
                <p className="text-xs text-foreground/50 mt-2 font-sans">Sepanjang waktu</p>
              </div>
              
              <div className="bg-surface border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all">
                <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Proyek Aktif</p>
                <h2 className="text-3xl md:text-4xl font-serif text-amber-500">{activeProjectsCount}</h2>
                <p className="text-xs text-foreground/50 mt-2 font-sans">Menunggu pemilihan klien</p>
              </div>
              
              <div className="bg-surface border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-all">
                <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Proyek Lunas</p>
                <h2 className="text-3xl md:text-4xl font-serif text-emerald-500">{completedProjectsCount}</h2>
                <p className="text-xs text-foreground/50 mt-2 font-sans">Selesai & dibayar</p>
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
