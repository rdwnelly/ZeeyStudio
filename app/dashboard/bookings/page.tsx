"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, updateDoc, doc } from "firebase/firestore";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  maxPhotos: number;
  createdAt: string;
  status: string;
  createdBy: string;
  assignedAdmin?: string;
  shootDate?: string;
  shootTime?: string;
  packageName?: string;
  packagePrice?: number;
  dpAmount?: number;
  gdriveLinkHighRes?: string;
};

export default function BookingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'aktif' | 'selesai'>('aktif');

  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [creatingFolderId, setCreatingFolderId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>({});
  const router = useRouter();

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
    const savedProfile = localStorage.getItem("zeey_profile");
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (e) {}
    }
  }, []);

  const updateStatus = async (id: string, newStatus: string, extraData: any = {}) => {
    try {
      await updateDoc(doc(db, "projects", id), {
        status: newStatus,
        ...extraData
      });

      const { logActivity } = await import("@/lib/audit");
      await logActivity("Ubah Status Pesanan", `Mengubah status pesanan ID ${id} menjadi ${newStatus}`);

      // WhatsApp Notification Logic
      const project = projects.find(p => p.id === id);
      
      if (project) {
        let message = "";
        if (newStatus === 'Menunggu Pemilihan') {
          message = `Halo ${project.clientName},\n\nSesi foto Anda sudah selesai!\nSilakan klik tautan berikut untuk memilih foto mana yang ingin kami edit:\n${window.location.origin}/client/${id}\n\nTerima kasih,\nZeey Studio`;
        } else if (newStatus === 'File Terkirim') {
          message = `Halo ${project.clientName},\n\nSemua file foto Anda (termasuk yang sudah diedit) telah siap!\nSilakan cek dan unduh melalui galeri Anda:\n${window.location.origin}/client/${id}\n\nTerima kasih telah mempercayakan momen berharga Anda pada Zeey Studio!`;
        }

        if (message) {
          // Format number (remove non-digits, ensure it starts with country code if needed, assuming it's mostly Indonesian 62 or 08)
          let phone = project.waNumber.replace(/[^0-9]/g, '');
          if (phone.startsWith('0')) {
            phone = '62' + phone.substring(1);
          }
          const encodedMessage = encodeURIComponent(message);
          const waUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
          window.open(waUrl, '_blank');
        }
      }

      // Auto-Payroll / Commission Logic
      if (newStatus === 'File Terkirim' && project?.assignedAdmin) {
        try {
          const { getDocs, query, where, collection, addDoc } = await import("firebase/firestore");
          // Assuming assignedAdmin is the name
          const adminQ = query(collection(db, "admins"), where("name", "==", project.assignedAdmin));
          const adminSnap = await getDocs(adminQ);
          
          if (!adminSnap.empty) {
            const adminData = adminSnap.docs[0].data();
            if (adminData.commission && adminData.commission > 0) {
              const expensesQ = query(collection(db, "expenses"), 
                 where("category", "==", "Komisi Tim"), 
                 where("description", "==", `Komisi - ${project.assignedAdmin} (ID: ${project.id.slice(-4)})`));
              const expensesSnap = await getDocs(expensesQ);
              
              if (expensesSnap.empty) {
                await addDoc(collection(db, "expenses"), {
                  description: `Komisi - ${project.assignedAdmin} (ID: ${project.id.slice(-4)})`,
                  amount: adminData.commission,
                  category: "Komisi Tim",
                  date: new Date().toISOString().split('T')[0],
                  createdAt: new Date().toISOString()
                });
                
                // Log activity
                await logActivity("Payroll Otomatis", `Komisi Rp${adminData.commission.toLocaleString('id-ID')} ditambahkan untuk ${project.assignedAdmin}`);
              }
            }
          }
        } catch (err) {
          console.error("Gagal mencatat komisi otomatis:", err);
        }
      }

      fetchProjects();
    } catch (e) {
      alert("Gagal mengupdate status");
      console.error(e);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pesanan klien "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      try {
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(doc(db, "projects", id));
        
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Hapus Pesanan", `Menghapus pesanan klien ${name} (${id})`);
        
        alert("Pesanan berhasil dihapus.");
        fetchProjects();
      } catch (err) {
        console.error("Gagal menghapus", err);
        alert("Gagal menghapus pesanan.");
      }
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
  
  const handleDateClick = (dateString: string) => {
    router.push(`/dashboard/create?date=${dateString}`);
  };

  const handleDownloadInvoice = async (project: Project) => {
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const invoiceElement = document.getElementById('invoice-template');
      if (!invoiceElement) throw new Error("Template not found");

      // We need to render the component visible temporarily for html2canvas
      invoiceElement.style.display = 'block';
      invoiceElement.style.position = 'fixed';
      invoiceElement.style.top = '0';
      invoiceElement.style.left = '0';
      invoiceElement.style.zIndex = '-9999';

      const canvas = await html2canvas(invoiceElement, { scale: 2 });
      
      invoiceElement.style.display = 'none'; // hide it back

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Invoice_ZeeyStudio_${project.clientName.replace(/\s+/g, '_')}.pdf`);

      const { logActivity } = await import("@/lib/audit");
      await logActivity("Generate Invoice", `Mengunduh invoice untuk ${project.clientName}`);
      
    } catch (err) {
      console.error("Gagal membuat PDF", err);
      alert("Gagal membuat PDF Invoice");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const sendWhatsAppLink = (project: Project) => {
    if (!project.waNumber) {
      alert("Nomor WhatsApp klien tidak tersedia.");
      return;
    }
    let phone = project.waNumber.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }
    const link = `${window.location.origin}/client/${project.id}`;
    let message = "";
    
    if (project.status === 'Menunggu Pembayaran' || project.status === 'Lunas') {
       message = `Halo ${project.clientName},\n\nBerikut adalah tautan galeri Anda di Zeey Studio:\n${link}\n\nNantinya Anda dapat melihat dan mengunduh foto Anda melalui tautan ini. Terima kasih!`;
    } else if (project.status === 'Menunggu Pemilihan') {
       message = `Halo ${project.clientName},\n\nSesi foto Anda sudah selesai!\nSilakan klik tautan berikut untuk memilih foto mana yang ingin kami edit:\n${link}\n\nTerima kasih,\nZeey Studio`;
    } else {
       message = `Halo ${project.clientName},\n\nSemua file foto Anda telah siap!\nSilakan cek dan unduh melalui galeri Anda:\n${link}\n\nTerima kasih telah mempercayakan momen berharga Anda pada Zeey Studio!`;
    }
    
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleCreateFolder = async (project: Project) => {
    setCreatingFolderId(project.id);
    try {
      const res = await fetch('/api/drive/create-project-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: project.clientName })
      });
      const data = await res.json();
      
      if (data.success && data.folderId) {
        const link = `https://drive.google.com/drive/folders/${data.folderId}`;
        await updateStatus(project.id, 'Menunggu Pemilihan', { 
          gdriveLinkHighRes: link,
          gdriveFolderId: data.folderId 
        });
        
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Buat Folder Drive", `Sistem otomatis membuat folder Drive untuk ${project.clientName}`);
      } else {
        alert("Gagal membuat folder: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat membuat folder otomatis.");
    } finally {
      setCreatingFolderId(null);
    }
  };

  const handleEventClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setSelectedProject(project);
    setIsModalOpen(true);
  };

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
        <div 
          key={d} 
          onClick={() => handleDateClick(dateString)}
          className={`p-2 border-r border-b ${isToday ? 'bg-accent/5' : 'bg-surface'} min-h-[120px] flex flex-col hover:bg-surface-alt/50 transition-colors cursor-pointer group`}
        >
          <div className="flex justify-between items-start mb-2">
            <span className={`text-xs font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-accent text-white' : 'text-foreground/70 group-hover:bg-foreground/10 transition-colors'}`}>{d}</span>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto hide-scrollbar max-h-[90px]">
            {dayProjects.map(p => (
              <div 
                key={p.id} 
                onClick={(e) => handleEventClick(e, p)}
                className={`text-[11px] p-1.5 rounded-md truncate border ${getStatusBadge(p.status)} hover:opacity-80 transition-opacity cursor-pointer shadow-sm`} 
                title={`${p.shootTime || ''} - ${p.clientName}`}
              >
                <span className="font-bold">{p.shootTime}</span> {p.clientName}
              </div>
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
        <div className="mb-6 border-b border-border/50 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Manajemen Pesanan</h1>
            <p className="text-foreground/70 font-sans text-sm md:text-base mb-6">
              {userRole === 'owner' ? 'Pantau seluruh jadwal studio dan status pesanan.' : `Jadwal pemotretan yang ditugaskan kepada Anda.`}
            </p>
            
            {/* Tabs dipindah ke atas */}
            <div className="flex gap-2 bg-surface-alt/50 p-1.5 rounded-xl border border-border w-full md:w-auto inline-flex overflow-x-auto hide-scrollbar">
              <button 
                onClick={() => setActiveTab('aktif')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'aktif' ? 'bg-background shadow-sm border border-border text-foreground' : 'text-foreground/60 hover:text-foreground hover:bg-background/50 border border-transparent'}`}
              >
                Pesanan Aktif
              </button>
              <button 
                onClick={() => setActiveTab('selesai')}
                className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'selesai' ? 'bg-background shadow-sm border border-border text-foreground' : 'text-foreground/60 hover:text-foreground hover:bg-background/50 border border-transparent'}`}
              >
                Riwayat Selesai
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-12">
            
            {/* Hanya tampilkan Kalender jika tab aktif */}
            {activeTab === 'aktif' && (
              <div className="bg-surface border border-border rounded-2xl p-4 md:p-6 shadow-sm overflow-hidden transition-all hover:shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-500/10 text-blue-500 p-2.5 rounded-xl hidden sm:block">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    </div>
                    <h2 className="text-xl md:text-2xl font-serif text-foreground">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={prevMonth} className="p-2 border border-border rounded-xl hover:bg-surface-alt transition-colors cursor-pointer">&larr;</button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 border border-border rounded-xl hover:bg-surface-alt transition-colors text-sm font-medium cursor-pointer">Hari Ini</button>
                    <button onClick={nextMonth} className="p-2 border border-border rounded-xl hover:bg-surface-alt transition-colors cursor-pointer">&rarr;</button>
                  </div>
                </div>
              
                <div className="overflow-x-auto pb-2 hide-scrollbar">
                  <div className="min-w-[700px]">
                    <div className="grid grid-cols-7 border-t border-l border-border rounded-xl overflow-hidden font-sans">
                      {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
                        <div key={day} className="bg-surface-alt py-3 border-r border-b border-border text-center text-xs font-semibold text-foreground/70 uppercase tracking-wider">{day}</div>
                      ))}
                      {renderCalendar()}
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Daftar Pesanan Aktif */}
          {activeTab === 'aktif' && (
          <div className="animate-in fade-in duration-300">
            <div className="space-y-4">
              {projects.filter(p => p.status !== 'File Terkirim').length === 0 ? (
                <div className="text-center p-12 bg-surface-alt/30 rounded-3xl border border-dashed border-border">
                  <p className="text-foreground/60">Belum ada pesanan aktif.</p>
                </div>
              ) : (
                projects.filter(p => p.status !== 'File Terkirim').map(project => (
                <div key={project.id} className="bg-surface border border-border rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row gap-6 md:items-start hover:shadow-md hover:border-accent/30 transition-all">
                  <div className="flex-1 space-y-4 font-sans w-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-1 w-full gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full">
                        <h3 className="text-xl md:text-2xl font-serif font-medium text-foreground">{project.clientName}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-3 py-1.5 rounded-full border font-medium whitespace-nowrap ${getStatusBadge(project.status)}`}>
                            {project.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 shrink-0 sm:ml-4 self-end sm:self-auto">
                        <Link href={`/dashboard/create?edit=${project.id}`} className="p-2 text-foreground/50 hover:text-blue-600 transition-colors bg-surface-alt rounded-lg border border-border hover:border-blue-300 hover:bg-blue-50" title="Edit Pesanan">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </Link>
                        <button onClick={() => handleDelete(project.id, project.clientName)} className="p-2 text-foreground/50 hover:text-red-600 transition-colors cursor-pointer bg-surface-alt rounded-lg border border-border hover:border-red-300 hover:bg-red-50" title="Hapus Pesanan">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-foreground/80 bg-surface-alt/30 p-4 rounded-xl border border-border/50">
                      <div className="flex items-center gap-2.5">
                        <div className="bg-background p-1.5 rounded-md border border-border shadow-sm">
                          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                        <span className="font-medium">{project.shootDate ? new Date(project.shootDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="bg-background p-1.5 rounded-md border border-border shadow-sm">
                          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <span className="font-medium">{project.shootTime || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="bg-background p-1.5 rounded-md border border-border shadow-sm">
                          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                        </div>
                        <span className="font-medium truncate" title={project.packageName}>{project.packageName || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="bg-background p-1.5 rounded-md border border-border shadow-sm">
                          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        </div>
                        <span className="font-medium">{project.assignedAdmin || '-'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 md:min-w-[240px] border-t md:border-t-0 md:border-l border-border pt-5 md:pt-0 md:pl-6 shrink-0">
                    {/* Status Actions based on Current Status */}
                    {project.status === 'Menunggu Pembayaran' && userRole === 'owner' && (
                      <button onClick={() => updateStatus(project.id, 'Lunas')} className="w-full bg-green-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-green-600 transition-colors shadow-sm cursor-pointer">
                        Tandai Lunas
                      </button>
                    )}
                    
                    {project.gdriveLinkHighRes && (
                      <button 
                        onClick={() => window.open(project.gdriveLinkHighRes, '_blank')}
                        className="w-full bg-blue-100 text-blue-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-200 transition-colors shadow-sm cursor-pointer mb-2 flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Upload Foto (Buka GDrive)
                      </button>
                    )}
                    
                    {project.status === 'Lunas' && !project.gdriveLinkHighRes && (
                      <div className="flex flex-col gap-2 mb-2">
                        <button 
                          onClick={() => handleCreateFolder(project)} 
                          disabled={creatingFolderId === project.id}
                          className="w-full bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {creatingFolderId === project.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Membuat Folder...
                            </>
                          ) : (
                            "Buat Folder GDrive (Otomatis)"
                          )}
                        </button>
                        
                        <button 
                          onClick={() => {
                            const link = prompt("Masukkan Link Google Drive untuk Klien (Folder Pemilihan):");
                            if (link) {
                              const folderIdMatch = link.match(/folders\/([a-zA-Z0-9-_]+)/) || link.match(/id=([a-zA-Z0-9-_]+)/);
                              const folderId = folderIdMatch ? folderIdMatch[1] : link; // fallback
                              
                              updateStatus(project.id, 'Menunggu Pemilihan', { 
                                gdriveLinkHighRes: link,
                                gdriveFolderId: folderId
                              });
                            }
                          }} 
                          className="w-full bg-surface-alt border border-border text-foreground px-4 py-2 rounded-xl text-xs font-medium hover:bg-border transition-colors cursor-pointer"
                        >
                          Atau Input Manual Link GDrive
                        </button>
                      </div>
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
                        onClick={() => sendWhatsAppLink(project)}
                        className="p-2 bg-green-100 text-green-700 border border-green-200 rounded-lg hover:bg-green-200 transition-colors cursor-pointer"
                        title="Kirim ke WhatsApp Klien"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                      </button>
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
          </div>
          )}

          {/* Daftar Pesanan Selesai */}
          {activeTab === 'selesai' && (
          <div className="animate-in fade-in duration-300">
            <div className="space-y-4">
              {projects.filter(p => p.status === 'File Terkirim').length === 0 ? (
                <div className="text-center p-12 bg-surface-alt/30 rounded-3xl border border-dashed border-border opacity-75">
                  <p className="text-foreground/60">Belum ada pesanan selesai.</p>
                </div>
              ) : (
                projects.filter(p => p.status === 'File Terkirim').map(project => (
                  <div key={project.id} className="bg-surface border border-border rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row gap-6 md:items-center hover:border-accent/30 transition-all opacity-80 hover:opacity-100">
                    <div className="flex-1 space-y-4 font-sans w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full mb-1">
                        <h3 className="text-xl md:text-2xl font-serif font-medium text-foreground">{project.clientName}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-3 py-1.5 rounded-full border font-medium whitespace-nowrap ${getStatusBadge(project.status)}`}>
                            {project.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-foreground/70 bg-surface-alt/30 p-4 rounded-xl border border-border/50">
                        <div className="flex items-center gap-2.5">
                          <div className="bg-background p-1.5 rounded-md border border-border shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          </div>
                          <span>{project.shootDate ? new Date(project.shootDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="bg-background p-1.5 rounded-md border border-border shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          </div>
                          <span>{project.shootTime || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="bg-background p-1.5 rounded-md border border-border shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                          </div>
                          <span className="truncate" title={project.packageName}>{project.packageName || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="bg-background p-1.5 rounded-md border border-border shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          </div>
                          <span>{project.assignedAdmin || '-'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 md:min-w-[240px] border-t md:border-t-0 md:border-l border-border pt-5 md:pt-0 md:pl-6 shrink-0">
                      <div className="flex gap-2 mt-auto pt-2">
                        <Link href={`/client/${project.id}`} target="_blank" className="flex-1 text-center bg-surface-alt border border-border px-3 py-2 rounded-lg text-sm font-medium hover:bg-border transition-colors">
                          Buka Galeri
                        </Link>
                        <button 
                          onClick={() => sendWhatsAppLink(project)}
                          className="p-2 bg-green-100 text-green-700 border border-green-200 rounded-lg hover:bg-green-200 transition-colors cursor-pointer"
                          title="Kirim ke WhatsApp Klien"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                        </button>
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

                      <button 
                        onClick={() => handleDownloadInvoice(project)}
                        disabled={isGeneratingPDF}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-border text-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-surface-alt transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isGeneratingPDF ? "Membuat PDF..." : "Unduh Invoice (PDF)"}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      </button>
                      
                      {userRole === 'owner' && (
                        <button 
                          onClick={() => updateStatus(project.id, 'Selesai Difoto')} 
                          className="w-full text-foreground/50 border border-border px-4 py-2 rounded-xl text-xs font-medium hover:bg-surface-alt transition-colors cursor-pointer"
                        >
                          Buka Kembali (Reopen)
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Event Detail Modal */}
      {isModalOpen && selectedProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}>
          <div className="bg-surface w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-6 md:p-8 border-b border-border/50 bg-surface-alt/30">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-serif mb-2">{selectedProject.clientName}</h2>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium whitespace-nowrap ${getStatusBadge(selectedProject.status)}`}>
                    {selectedProject.status}
                  </span>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-foreground/50 hover:text-foreground hover:bg-surface-alt rounded-full transition-colors cursor-pointer">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 md:p-8 space-y-4 font-sans text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background border border-border p-3 rounded-xl">
                  <p className="text-foreground/50 mb-1 text-xs uppercase tracking-wider font-semibold">Tanggal</p>
                  <p className="font-medium text-foreground">{selectedProject.shootDate ? new Date(selectedProject.shootDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}</p>
                </div>
                <div className="bg-background border border-border p-3 rounded-xl">
                  <p className="text-foreground/50 mb-1 text-xs uppercase tracking-wider font-semibold">Waktu</p>
                  <p className="font-medium text-foreground">{selectedProject.shootTime || '-'}</p>
                </div>
                <div className="bg-background border border-border p-3 rounded-xl">
                  <p className="text-foreground/50 mb-1 text-xs uppercase tracking-wider font-semibold">Paket</p>
                  <p className="font-medium text-foreground">{selectedProject.packageName || '-'}</p>
                </div>
                <div className="bg-background border border-border p-3 rounded-xl">
                  <p className="text-foreground/50 mb-1 text-xs uppercase tracking-wider font-semibold">Fotografer</p>
                  <p className="font-medium text-foreground">{selectedProject.assignedAdmin || '-'}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 md:p-8 border-t border-border/50 flex flex-col gap-3">
              {selectedProject.status === 'Menunggu Pembayaran' && userRole === 'owner' && (
                <button onClick={() => { updateStatus(selectedProject.id, 'Lunas'); setIsModalOpen(false); }} className="w-full bg-green-500 text-white px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-green-600 transition-colors shadow-sm cursor-pointer">
                  Tandai Lunas
                </button>
              )}
              
              {selectedProject.status === 'Lunas' && (
                <button 
                  onClick={() => {
                    if (selectedProject.gdriveLinkHighRes) {
                      // Buka folder di tab baru
                      window.open(selectedProject.gdriveLinkHighRes, '_blank');
                      
                      // Konfirmasi penyelesaian
                      setTimeout(() => {
                        if (confirm("Apakah Anda sudah selesai mengunggah (upload) semua foto ke dalam folder Google Drive tersebut?")) {
                          updateStatus(selectedProject.id, 'Menunggu Pemilihan');
                          setIsModalOpen(false);
                        }
                      }, 500);
                    } else {
                      // Fallback jika tidak ada link otomatis
                      const link = prompt("Masukkan Link Google Drive untuk Klien (Folder Pemilihan):");
                      if (link) {
                        const folderIdMatch = link.match(/folders\/([a-zA-Z0-9-_]+)/) || link.match(/id=([a-zA-Z0-9-_]+)/);
                        const folderId = folderIdMatch ? folderIdMatch[1] : link; // fallback
                        
                        updateStatus(selectedProject.id, 'Menunggu Pemilihan', { 
                          gdriveLinkHighRes: link,
                          gdriveFolderId: folderId
                        });
                        setIsModalOpen(false);
                      }
                    }
                  }} 
                  className="w-full bg-blue-500 text-white px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
                >
                  {selectedProject.gdriveLinkHighRes ? "Buka Folder & Selesai Foto" : "Paste Link GDrive & Selesai Foto"}
                </button>
              )}
              
              {(selectedProject.status === 'Menunggu Pemilihan' || selectedProject.status === 'Selesai Difoto') && (
                <button onClick={() => { updateStatus(selectedProject.id, 'File Terkirim'); setIsModalOpen(false); }} className="w-full bg-foreground text-surface px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-black transition-colors shadow-sm cursor-pointer">
                  Tandai File Terkirim (Tutup)
                </button>
              )}
              
              <Link href={`/client/${selectedProject.id}`} target="_blank" className="w-full flex items-center justify-center gap-2 bg-surface-alt border border-border px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-border transition-colors">
                Buka Galeri Klien
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              </Link>
              
              <button 
                onClick={() => handleDownloadInvoice(selectedProject)}
                disabled={isGeneratingPDF}
                className="w-full flex items-center justify-center gap-2 bg-white border border-border text-foreground px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-surface-alt transition-colors disabled:opacity-50"
              >
                {isGeneratingPDF ? "Membuat PDF..." : "Unduh Invoice (PDF)"}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Invoice Template for PDF Generation */}
      {selectedProject && (
        <div id="invoice-template" style={{ display: 'none', width: '1122px', backgroundColor: 'white', padding: '40px', color: 'black', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #f3f4f6', paddingBottom: '20px', marginBottom: '30px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 5px 0', color: '#111827' }}>INVOICE</h1>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>#INV-{selectedProject.id.slice(-6).toUpperCase()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                <svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                  <circle cx="12" cy="13" r="3"></circle>
                </svg>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{profile?.studioName || "Zeey Studio"}</h2>
              </div>
              <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#4b5563', whiteSpace: 'pre-wrap' }}>{profile?.address || "Alamat Studio Belum Diatur"}</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#4b5563' }}>{profile?.email || (profile?.waNumber ? `WA: ${profile.waNumber}` : "-")}</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 8px 0' }}>Ditagihkan Kepada:</p>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#111827' }}>{selectedProject.clientName}</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#4b5563' }}>{selectedProject.waNumber || '-'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 4px 0' }}>Tanggal Invoice</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                  {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 4px 0' }}>Status Pembayaran</p>
                <span style={{ 
                  display: 'inline-block', 
                  padding: '4px 12px', 
                  borderRadius: '9999px', 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  backgroundColor: selectedProject.status === 'Menunggu Pembayaran' ? '#fef9c3' : '#dcfce3',
                  color: selectedProject.status === 'Menunggu Pembayaran' ? '#854d0e' : '#166534',
                }}>
                  {selectedProject.status === 'Menunggu Pembayaran' ? 'BELUM LUNAS' : 'LUNAS'}
                </span>
              </div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', color: '#4b5563', fontWeight: '600' }}>Deskripsi Layanan</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: '#4b5563', fontWeight: '600' }}>Tanggal Foto</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: '#4b5563', fontWeight: '600' }}>Total Harga</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '16px 12px', fontSize: '15px', color: '#111827', fontWeight: '500' }}>{selectedProject.packageName}</td>
                <td style={{ padding: '16px 12px', textAlign: 'center', fontSize: '14px', color: '#4b5563' }}>
                  {selectedProject.shootDate ? new Date(selectedProject.shootDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}
                </td>
                <td style={{ padding: '16px 12px', textAlign: 'right', fontSize: '15px', color: '#111827', fontWeight: '500' }}>
                  Rp {(selectedProject.packagePrice || 0).toLocaleString("id-ID")}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '60px' }}>
            <div style={{ width: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '14px', color: '#4b5563' }}>Subtotal</span>
                <span style={{ fontSize: '14px', color: '#111827', fontWeight: '500' }}>Rp {(selectedProject.packagePrice || 0).toLocaleString("id-ID")}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', borderRadius: '0 0 8px 8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>Total Bayar</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>Rp {(selectedProject.packagePrice || 0).toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', marginTop: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
            <p style={{ margin: '0 0 4px 0' }}>Terima kasih telah menggunakan jasa {profile?.studioName || "Zeey Studio"}.</p>
            <p style={{ margin: 0 }}>Invoice ini sah dan digenerate secara otomatis oleh sistem.</p>
            {(profile?.instagram || profile?.tiktok) && (
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                {profile?.instagram && <span style={{ marginRight: '10px' }}>IG: {profile.instagram}</span>}
                {profile?.tiktok && <span>TikTok: {profile.tiktok}</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </Sidebar>
  );
}
