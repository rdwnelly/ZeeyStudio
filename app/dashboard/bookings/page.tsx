"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, updateDoc, doc } from "firebase/firestore";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  maxPhotos: number;
  createdAt: string;
  status: 'Menunggu Pembayaran' | 'Lunas' | 'Selesai Difoto' | 'Menunggu Pemilihan' | 'File Terkirim' | 'Selesai';
  createdBy: string;
  assignedAdmin?: string;
  shootDate?: string;
  shootTime?: string;
  packageName?: string;
  gdriveLinkHighRes?: string;
};

export default function BookingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const role = localStorage.getItem("zeey_auth_role") || "";
      const name = localStorage.getItem("zeey_auth_user") || "";
      setUserRole(role);
      setUserName(name);

      const q = query(collection(db, "projects"));
      const snapshot = await getDocs(q);
      let data: Project[] = [];
      
      snapshot.forEach((doc) => {
        let p = { id: doc.id, ...doc.data() } as Project;
        // Backward compatibility
        if (!p.status) p.status = 'Menunggu Pemilihan';
        if (p.status === 'Selesai') p.status = 'File Terkirim'; // Map old 'Selesai'
        data.push(p);
      });

      if (role === 'admin') {
        data = data.filter(p => p.assignedAdmin === name || p.createdBy === name);
      }
      
      // Sort list view by shootDate ascending (closest first), fallback to createdAt
      data.sort((a, b) => {
        const timeA = a.shootDate ? new Date(a.shootDate).getTime() : new Date(a.createdAt).getTime();
        const timeB = b.shootDate ? new Date(b.shootDate).getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA; // default descending
      });

      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const updateStatus = async (id: string, newStatus: string, extraData: any = {}) => {
    try {
      await updateDoc(doc(db, "projects", id), {
        status: newStatus,
        ...extraData
      });
      fetchProjects();
    } catch (e) {
      alert("Gagal mengupdate status");
      console.error(e);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Menunggu Pembayaran': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Lunas': return 'bg-green-100 text-green-700 border-green-200';
      case 'Selesai Difoto': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Menunggu Pemilihan': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'File Terkirim': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Calendar Helpers
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const renderCalendar = () => {
    const days = [];
    // Empty slots before 1st day
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 border-r border-b border-border bg-surface-alt/20 min-h-[100px]"></div>);
    }
    
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      const dayProjects = projects.filter(p => p.shootDate === dateString);
      const isToday = dateString === new Date().toISOString().split('T')[0];

      days.push(
        <div key={d} className={`p-2 border-r border-b ${isToday ? 'bg-accent/5' : 'bg-surface'} min-h-[100px] flex flex-col`}>
          <div className="flex justify-between items-start mb-1">
            <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-accent text-white' : 'text-foreground/70'}`}>{d}</span>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto hide-scrollbar max-h-[80px]">
            {dayProjects.map(p => (
              <Link href={`/client/${p.id}`} target="_blank" key={p.id} className={`block text-[10px] p-1 rounded truncate border ${getStatusBadge(p.status)} hover:opacity-80 transition-opacity`} title={`${p.shootTime || ''} - ${p.clientName}`}>
                <span className="font-bold">{p.shootTime}</span> {p.clientName}
              </Link>
            ))}
          </div>
        </div>
      );
    }
    
    // Pad remaining grid spaces
    const totalCells = days.length;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < remaining; i++) {
       days.push(<div key={`end-empty-${i}`} className="p-2 border-r border-b border-border bg-surface-alt/20 min-h-[100px]"></div>);
    }
    
    return days;
  };

  return (
    <Sidebar>
      <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in duration-500 pb-24">
        <div className="mb-6 border-b border-border/50 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Manajemen Pesanan</h1>
            <p className="text-foreground/70 font-sans text-sm md:text-base">
              {userRole === 'owner' ? 'Pantau seluruh jadwal studio dan status pesanan.' : `Jadwal pemotretan yang ditugaskan kepada Anda.`}
            </p>
          </div>
          <div className="flex gap-3">
            <div className="bg-surface border border-border rounded-xl p-1 flex">
              <button 
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-accent text-white shadow-sm' : 'text-foreground/70 hover:bg-surface-alt cursor-pointer'}`}
              >
                Daftar
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'calendar' ? 'bg-accent text-white shadow-sm' : 'text-foreground/70 hover:bg-surface-alt cursor-pointer'}`}
              >
                Kalender
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : viewMode === 'calendar' ? (
          <div className="bg-surface border border-border rounded-3xl p-4 md:p-6 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl md:text-2xl font-serif">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 border border-border rounded-lg hover:bg-surface-alt transition-colors cursor-pointer">&larr;</button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-2 border border-border rounded-lg hover:bg-surface-alt transition-colors text-sm font-medium cursor-pointer">Hari Ini</button>
                <button onClick={nextMonth} className="p-2 border border-border rounded-lg hover:bg-surface-alt transition-colors cursor-pointer">&rarr;</button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 border-t border-l border-border rounded-xl overflow-hidden font-sans">
              {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
                <div key={day} className="bg-surface-alt py-2 border-r border-b border-border text-center text-xs font-semibold text-foreground/60">{day}</div>
              ))}
              {renderCalendar()}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.length === 0 ? (
              <div className="text-center p-12 bg-surface-alt/30 rounded-3xl border border-dashed border-border">
                <p className="text-foreground/60">Belum ada pesanan.</p>
              </div>
            ) : (
              projects.map(project => (
                <div key={project.id} className="bg-surface border border-border rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row gap-6 md:items-center hover:border-accent/30 transition-colors">
                  <div className="flex-1 space-y-3 font-sans">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="text-xl font-serif font-medium">{project.clientName}</h3>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium whitespace-nowrap ${getStatusBadge(project.status)}`}>
                        {project.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-3 text-sm text-foreground/80">
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        {project.shootDate ? new Date(project.shootDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        {project.shootTime || '-'}
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                        {project.packageName || '-'}
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        {project.assignedAdmin || '-'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 min-w-[200px] border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                    {/* Status Actions based on Current Status */}
                    {project.status === 'Menunggu Pembayaran' && userRole === 'owner' && (
                      <button onClick={() => updateStatus(project.id, 'Lunas')} className="w-full bg-green-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-green-600 transition-colors shadow-sm cursor-pointer">
                        Tandai Lunas
                      </button>
                    )}
                    
                    {project.status === 'Lunas' && (
                      <button 
                        onClick={() => {
                          const link = prompt("Masukkan Link Google Drive untuk Klien (Folder Pemilihan):");
                          if (link) updateStatus(project.id, 'Menunggu Pemilihan', { gdriveLinkHighRes: link });
                        }} 
                        className="w-full bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
                      >
                        Upload GDrive & Selesai Foto
                      </button>
                    )}
                    
                    {(project.status === 'Menunggu Pemilihan' || project.status === 'Selesai Difoto') && (
                      <button onClick={() => updateStatus(project.id, 'File Terkirim')} className="w-full bg-foreground text-surface px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-black transition-colors shadow-sm cursor-pointer">
                        Tandai File Terkirim (Tutup)
                      </button>
                    )}
                    
                    <div className="flex gap-2 mt-auto pt-2">
                      <Link href={`/client/${project.id}`} target="_blank" className="flex-1 text-center bg-surface-alt border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-border transition-colors">
                        Buka Galeri
                      </Link>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/client/${project.id}`);
                          alert("Tautan disalin!");
                        }}
                        className="p-2 bg-surface-alt border border-border rounded-lg hover:bg-border transition-colors cursor-pointer"
                        title="Salin Tautan Klien"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Sidebar>
  );
}
