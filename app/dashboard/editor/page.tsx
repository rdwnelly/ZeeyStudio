"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { PageHeader, SkeletonBlock, StatCard } from "@/components/ui";
import { db } from "@/lib/firebase";
import { normalizeWaNumber } from "@/lib/phone";
import { collection, getDocs, updateDoc, doc, query, orderBy } from "firebase/firestore";
import Link from "next/link";

type EditorRequest = {
  id: string;
  projectId: string;
  clientName: string;
  notes: string;
  status: "Pending" | "In Progress" | "Selesai";
  createdAt: string;
  editedDriveLink?: string;
};

export default function EditorDashboard() {
  const [requests, setRequests] = useState<EditorRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'aktif' | 'selesai'>('aktif');

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleOpenDriveFolder = async (projectId: string, reqId: string) => {
    try {
      const { getDoc } = await import("firebase/firestore");
      const projectDoc = await getDoc(doc(db, "projects", projectId));
      
      if (!projectDoc.exists() || !projectDoc.data().gdriveLinkHighRes) {
        alert("Folder Google Drive tidak ditemukan untuk proyek ini.");
        return;
      }
      
      const link = projectDoc.data().gdriveLinkHighRes;
      const { formatGDriveUrl } = await import("@/lib/drive-utils");
      
      window.open(formatGDriveUrl(link), '_blank');
    } catch (err) {
      console.error(err);
      alert("Gagal membuka folder Google Drive.");
    }
  };

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "editor_requests"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const reqList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EditorRequest));
      setRequests(reqList);
    } catch (error) {
      console.error("Error fetching editor requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string, projectId?: string) => {
    try {
      await updateDoc(doc(db, "editor_requests", id), {
        status: newStatus
      });

      const { logActivity } = await import("@/lib/audit");
      await logActivity("Tugas Editor", `Mengubah status tugas editor ID ${id} menjadi ${newStatus}`);

      if (newStatus === "Selesai" && projectId) {
        const { getDoc } = await import("firebase/firestore");
        const projectDoc = await getDoc(doc(db, "projects", projectId));
        const project = projectDoc.exists() ? projectDoc.data() : null;

        if (project && project.waNumber) {
          const message = `Halo ${project.clientName},\n\nTim Editor kami telah selesai memproses foto pilihan Anda!\nSilakan cek hasil editnya di galeri Anda:\n${window.location.origin}/client/${projectId}\n\nTerima kasih,\nZeey Studio`;
          
          const cleanNumber = normalizeWaNumber(project.waNumber);
          const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
          window.open(waUrl, '_blank');
        }
      }

      fetchRequests();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Gagal mengupdate status tugas.");
    }
  };

  const sendWhatsAppDirect = async (req: EditorRequest) => {
    try {
        const { getDoc } = await import("firebase/firestore");
        const projectDoc = await getDoc(doc(db, "projects", req.projectId));
        const project = projectDoc.exists() ? projectDoc.data() : null;

        if (!project || !project.gdriveLinkHighRes) {
            alert("Data proyek atau Folder Google Drive tidak ditemukan.");
            return;
        }

        const link = req.editedDriveLink || project.gdriveLinkHighRes;
        
        if (!req.editedDriveLink) {
          await updateDoc(doc(db, "editor_requests", req.id), {
              editedDriveLink: link
          });
        }

        if (project.waNumber) {
            const cleanNumber = normalizeWaNumber(project.waNumber);
            
            const message = `Halo ${project.clientName},\n\nBerikut adalah link Google Drive untuk foto-foto yang sudah selesai diedit:\n\n${link}\n\nTerima kasih,\nZeey Studio`;
            const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
            
            if (confirm("Apakah Anda yakin ingin mengirim pesan WhatsApp ke klien? (Ini akan membuka WhatsApp Web/App)")) {
                window.open(waUrl, '_blank');
            }
        } else {
            alert("Data proyek atau nomor WhatsApp klien tidak ditemukan.");
        }
    } catch (err) {
        console.error("Error sending WA:", err);
        alert("Gagal memuat data klien atau menyimpan link.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-400 text-[10px] font-bold whitespace-nowrap">Menunggu</span>;
      case "In Progress":
        return <span className="px-2.5 py-1 rounded-full bg-sky-500/12 text-sky-600 dark:text-sky-400 text-[10px] font-bold whitespace-nowrap">Dikerjakan</span>;
      case "Selesai":
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold whitespace-nowrap">Selesai</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-foreground/8 text-foreground/60 text-[10px] font-bold whitespace-nowrap">{status}</span>;
    }
  };

  // Angka ringkasan tugas editor
  const countPending = requests.filter(r => r.status === "Pending").length;
  const countProgress = requests.filter(r => r.status === "In Progress").length;
  const countDone = requests.filter(r => r.status === "Selesai").length;

  return (
    <Sidebar>
      <div className="p-3.5 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-8">
        <PageHeader
          module="editor"
          title="Tugas Editor"
          subtitle="Kelola daftar request editing dari klien."
          actions={
            <button 
            onClick={fetchRequests}
            className="flex items-center gap-2 text-sm bg-surface-alt hover:bg-surface border border-border px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Refresh
          </button>
          }
        />

        {/* ── Ringkasan tugas ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-4 stagger">
          <StatCard label="Menunggu" value={countPending} hint="Belum dikerjakan" tone="amber" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          <StatCard label="Dikerjakan" value={countProgress} hint="Sedang diedit" tone="sky" icon="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          <StatCard label="Selesai" value={countDone} hint="Sudah dikirim" tone="emerald" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-surface-alt/70 p-1 rounded-2xl border border-border/60 w-full md:w-auto inline-flex overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab('aktif')}
            className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'aktif' ? 'bg-surface shadow-md border border-transparent text-foreground' : 'text-foreground/60 hover:text-foreground hover:bg-background/50 border border-transparent'}`}
          >
            Tugas Aktif
          </button>
          <button 
            onClick={() => setActiveTab('selesai')}
            className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'selesai' ? 'bg-surface shadow-md border border-transparent text-foreground' : 'text-foreground/60 hover:text-foreground hover:bg-background/50 border border-transparent'}`}
          >
            Riwayat Selesai
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-72" />)}
          </div>
        ) : requests.filter(req => activeTab === 'aktif' ? req.status !== 'Selesai' : req.status === 'Selesai').length === 0 ? (
          <div className="text-center py-16 rounded-3xl border border-dashed border-border bg-surface-alt/30 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border/60 text-foreground/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-foreground mb-2">Belum ada request.</h3>
            <p className="text-foreground/60 font-sans max-w-md mx-auto">
              {activeTab === 'aktif' 
                ? "Saat ini belum ada permintaan editing aktif dari klien. Request baru akan muncul di sini secara otomatis." 
                : "Belum ada riwayat tugas editing yang selesai."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 stagger">
            {requests.filter(req => activeTab === 'aktif' ? req.status !== 'Selesai' : req.status === 'Selesai').map((req) => (
              <div key={req.id} className="rounded-3xl bg-surface border border-border/70 shadow-sm overflow-hidden flex flex-col lift">
                <div className="p-4 border-b border-border/60 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-bold tracking-tight text-sm text-foreground truncate">{req.clientName}</h3>
                    <p className="text-xs text-foreground/50 font-sans font-mono flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      {new Date(req.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div>
                    {getStatusBadge(req.status)}
                  </div>
                </div>
                
                <div className="p-4 flex-1 flex flex-col">
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                      <p className="text-xs text-foreground/50 font-bold uppercase tracking-wider">Catatan Klien</p>
                    </div>
                    <div className="bg-surface border border-border/60 rounded-xl p-4 text-sm font-sans text-foreground/80 max-h-36 overflow-y-auto leading-relaxed shadow-inner">
                      {req.notes ? req.notes : <span className="italic text-foreground/40">Tidak ada catatan khusus dari klien.</span>}
                    </div>
                  </div>

                  {(req.status === "In Progress" || req.status === "Selesai") && (
                    <div className="mb-6 bg-surface p-4 border border-border/60 rounded-2xl shadow-sm">
                      <label className="text-xs text-foreground/50 font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-fuchsia-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Upload Editan (Drive)
                      </label>
                      <div className="flex flex-col gap-3 mb-4">
                        <button 
                          onClick={() => handleOpenDriveFolder(req.projectId, req.id)}
                          className="w-full relative bg-surface-alt/50 border-2 border-dashed border-border hover:border-fuchsia-500/60 hover:bg-fuchsia-500/5 rounded-2xl px-4 py-5 text-center cursor-pointer transition-all group/upload"
                        >
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-500 text-white flex items-center justify-center shadow-lg shadow-fuchsia-500/30 group-hover/upload:scale-110 transition-transform">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground/80 mt-1">Buka Folder GDrive Klien</span>
                                <span className="text-xs text-foreground/40 mt-0.5">Lihat foto pilihan untuk diedit</span>
                              </div>
                            </div>
                        </button>
                        
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder="Atau Paste Link GDrive Hasil Edit..."
                            defaultValue={req.editedDriveLink || ""}
                            onBlur={async (e) => {
                              const val = e.target.value.trim();
                              if (val && val !== req.editedDriveLink) {
                                try {
                                  await updateDoc(doc(db, "editor_requests", req.id), { editedDriveLink: val });
                                  const { logActivity } = await import("@/lib/audit");
                                  await logActivity("Upload Editan", `Menyimpan link editan untuk klien ${req.clientName}`);
                                  // Jangan panggil fetchRequests() di sini agar input tidak kehilangan fokus/berkedip
                                } catch(err) {
                                  console.error(err);
                                }
                              }
                            }}
                            className="w-full bg-surface border border-border/60 text-foreground text-sm rounded-xl pl-4 pr-20 py-3 hover:border-purple-300 focus:border-purple-500 focus:outline-none transition-all shadow-sm"
                          />
                          <div className="absolute right-2 top-2 pointer-events-none">
                            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                              Link
                            </span>
                          </div>
                        </div>

                        <div className="relative flex items-center py-1 opacity-60 mt-1">
                          <div className="flex-grow border-t border-border"></div>
                          <span className="flex-shrink-0 mx-3 text-foreground/40 text-[10px] font-bold tracking-widest uppercase">Foto Klien</span>
                          <div className="flex-grow border-t border-border"></div>
                        </div>

                        <Link 
                          href={`/client/${req.projectId}`}
                          target="_blank"
                          className="w-full bg-surface border border-border/60 text-foreground text-sm rounded-xl px-4 py-3 hover:bg-surface-alt hover:border-fuchsia-500/40 transition-all flex items-center justify-center gap-2 group/link"
                        >
                          <svg className="w-4 h-4 text-fuchsia-500 group-hover/link:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                          Lihat Foto Pilihan Klien
                        </Link>
                      </div>

                      <button 
                        onClick={() => sendWhatsAppDirect(req)}
                        className="w-full py-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-bold shadow-md shadow-emerald-500/25 hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer press"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Kirim WA ke Klien
                      </button>
                    </div>
                  )}
                  
                  <div className="flex gap-3 mt-auto pt-2 border-t border-border/50">
                    {req.status === "Pending" && (
                      <button 
                        onClick={() => updateStatus(req.id, "In Progress")}
                        className="flex-1 py-2.5 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white text-xs font-bold shadow-md shadow-sky-500/25 hover:brightness-110 transition-all cursor-pointer press"
                      >
                        Kerjakan Sekarang
                      </button>
                    )}
                    {req.status === "In Progress" && (
                      <button 
                        onClick={() => updateStatus(req.id, "Selesai", req.projectId)}
                        className="flex-1 py-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-bold shadow-md shadow-emerald-500/25 hover:brightness-110 transition-all cursor-pointer press"
                      >
                        Tandai Selesai
                      </button>
                    )}
                    <Link 
                      href={`/client/${req.projectId}`}
                      target="_blank"
                      className="py-2.5 px-4 rounded-2xl bg-surface-alt/70 border border-border/60 text-xs font-bold hover:bg-surface-alt transition-colors flex items-center justify-center cursor-pointer press"
                      title="Lihat Galeri Klien"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sidebar>
  );
}
