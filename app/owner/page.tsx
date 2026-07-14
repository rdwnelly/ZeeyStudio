"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  gdriveLinkHighRes: string;
  maxPhotos: number;
  createdAt: string;
  driveFolderId?: string;
  status?: 'Menunggu Pemilihan' | 'Selesai';
  extraRevenue?: number;
  completedAt?: string;
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default function OwnerPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [completedProjectsCount, setCompletedProjectsCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
    setProjects(savedProjects);
    
    // Summary Metrics
    let active = 0;
    let completed = 0;
    let revenue = 0;
    
    savedProjects.forEach((p: Project) => {
      if (p.status === 'Selesai') completed++;
      else active++;
      
      if (p.extraRevenue) revenue += p.extraRevenue;
    });
    
    setActiveProjectsCount(active);
    setCompletedProjectsCount(completed);
    setTotalRevenue(revenue);
    
    // Prepare Chart Data (Last 6 Months)
    const last6Months = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      last6Months.push({
        key,
        label: `${monthNames[month.getMonth()]} ${month.getFullYear()}`,
        revenue: 0,
        proyek: 0
      });
    }

    savedProjects.forEach((p: Project) => {
      // Proyek dibuat
      const createdDate = new Date(p.createdAt);
      const createdKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
      const cMonth = last6Months.find(m => m.key === createdKey);
      if (cMonth) cMonth.proyek += 1;
      
      // Proyek selesai / revenue
      if (p.completedAt && p.extraRevenue) {
        const compDate = new Date(p.completedAt);
        const compKey = `${compDate.getFullYear()}-${String(compDate.getMonth() + 1).padStart(2, '0')}`;
        const rMonth = last6Months.find(m => m.key === compKey);
        if (rMonth) rMonth.revenue += p.extraRevenue;
      } else if (p.status === 'Selesai' && p.extraRevenue) {
        // Fallback for missing completedAt but has extraRevenue (assume created month)
        const rMonth = last6Months.find(m => m.key === createdKey);
        if (rMonth) rMonth.revenue += p.extraRevenue;
      }
    });

    setChartData(last6Months);
  }, []);

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  return (
    <Sidebar>
      <div className="p-6 md:p-10 max-w-6xl mx-auto w-full pb-24">
        <div className="mb-8 border-b border-border pb-6 flex flex-col md:flex-row justify-between md:items-end gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl text-foreground mb-2">Portal Owner</h1>
            <p className="text-foreground/70 font-sans">Dasbor Analitik Bisnis & Kinerja Studio</p>
          </div>
          <Link
            href="/owner/projects"
            className="bg-accent text-white px-6 py-3 rounded-lg font-medium hover:bg-accent-dark transition-colors shadow-md text-sm text-center"
          >
            Manajemen Proyek ({activeProjectsCount} Aktif)
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Total Pendapatan Ekstra</p>
            <h2 className="text-2xl md:text-3xl font-serif text-accent">{formatRupiah(totalRevenue)}</h2>
            <p className="text-xs text-foreground/50 mt-2 font-sans">Dari biaya tambahan foto</p>
          </div>
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Total Proyek</p>
            <h2 className="text-2xl md:text-3xl font-serif text-foreground">{projects.length}</h2>
            <p className="text-xs text-foreground/50 mt-2 font-sans">Sepanjang waktu</p>
          </div>
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Proyek Aktif</p>
            <h2 className="text-2xl md:text-3xl font-serif text-amber-600">{activeProjectsCount}</h2>
            <p className="text-xs text-foreground/50 mt-2 font-sans">Menunggu pemilihan</p>
          </div>
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-foreground/60 font-sans uppercase tracking-wider mb-2">Proyek Lunas</p>
            <h2 className="text-2xl md:text-3xl font-serif text-green-600">{completedProjectsCount}</h2>
            <p className="text-xs text-foreground/50 mt-2 font-sans">Selesai & dibayar</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          
          {/* Revenue Area Chart */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
            <h3 className="text-xl font-serif mb-6 border-b border-border pb-3">Tren Pendapatan Ekstra (6 Bulan)</h3>
            <div className="h-[300px] w-full font-sans text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6b7280'}}
                    tickFormatter={(value) => `Rp ${value / 1000}k`}
                    dx={-10}
                  />
                  <RechartsTooltip 
                    formatter={(value: number) => [formatRupiah(value), "Pendapatan"]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Project Bar Chart */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
            <h3 className="text-xl font-serif mb-6 border-b border-border pb-3">Tren Klien Baru (6 Bulan)</h3>
            <div className="h-[300px] w-full font-sans text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} dy={10} />
                  <YAxis 
                    allowDecimals={false}
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#6b7280'}}
                  />
                  <RechartsTooltip 
                    formatter={(value: number) => [value, "Proyek Baru"]}
                    cursor={{fill: '#f3f4f6'}}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  />
                  <Bar dataKey="proyek" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </Sidebar>
  );
}
