"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { db } from "@/lib/firebase";
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
  const [driveLinks, setDriveLinks] = useState<Record<string, string>>({});
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>, reqId: string, projectId: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(prev => ({ ...prev, [reqId]: true }));
    try {
      // Get the project to find the drive folder ID
      const { getDoc } = await import("firebase/firestore");
      const projectDoc = await getDoc(doc(db, "projects", projectId));
      
      if (!projectDoc.exists() || !projectDoc.data().gdriveFolderId) {
        alert("Folder Google Drive tidak ditemukan untuk proyek ini. Harap buat folder otomatis terlebih dahulu di halaman Bookings.");
        setUploadingFiles(prev => ({ ...prev, [reqId]: false }));
        return;
      }
      
      const folderId = projectDoc.data().gdriveFolderId;
      
      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        formData.append('folderId', folderId);

        const res = await fetch('/api/drive/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!data.success) {
          console.error("Upload error:", data.error);
        }
      }
      
      alert(`Berhasil mengunggah ${files.length} foto ke Google Drive!`);
      // Update the drive link input if it's empty
      if (!driveLinks[reqId]) {
        const newLink = projectDoc.data().gdriveLinkHighRes;
        setDriveLinks(prev => ({ ...prev, [reqId]: newLink }));
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mengunggah foto.");
    } finally {
      setUploadingFiles(prev => ({ ...prev, [reqId]: false }));
    }
  };

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "editor_requests"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const reqList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EditorRequest));
      setRequests(reqList);
      
      const initialLinks: Record<string, string> = {};
      reqList.forEach(req => {
        if (req.editedDriveLink) initialLinks[req.id] = req.editedDriveLink;
      });
      setDriveLinks(initialLinks);
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
          
          let cleanNumber = project.waNumber.replace(/[^0-9]/g, "");
          if (cleanNumber.startsWith("0")) {
              cleanNumber = "62" + cleanNumber.substring(1);
          }
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
    const link = driveLinks[req.id];
    if (!link) {
        alert("Mohon isi link Google Drive terlebih dahulu.");
        return;
    }
    
    try {
        await updateDoc(doc(db, "editor_requests", req.id), {
            editedDriveLink: link
        });

        const { getDoc } = await import("firebase/firestore");
        const projectDoc = await getDoc(doc(db, "projects", req.projectId));
        const project = projectDoc.exists() ? projectDoc.data() : null;

        if (project && project.waNumber) {
            let cleanNumber = project.waNumber.replace(/[^0-9]/g, "");
            if (cleanNumber.startsWith("0")) {
                cleanNumber = "62" + cleanNumber.substring(1);
            }
            
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
        return <span className="px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">Menunggu</span>;
      case "In Progress":
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">Sedang Dikerjakan</span>;
      case "Selesai":
        return <span className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-medium">Selesai</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  return (
    <Sidebar>
      <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full pb-24 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border/50 pb-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif flex items-center gap-3">
              <span className="bg-purple-100 text-purple-600 p-2 rounded-xl">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                </svg>
              </span>
              Tugas Editor
            </h1>
            <p className="text-foreground/60 font-sans text-sm md:text-base">Kelola daftar request editing dari klien.</p>
          </div>
          <button 
            onClick={fetchRequests}
            className="flex items-center gap-2 text-sm bg-surface-alt hover:bg-surface border border-border px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-foreground/50 font-sans animate-pulse">Memuat daftar tugas...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20 bg-surface border border-dashed border-border rounded-3xl">
            <div className="w-20 h-20 bg-purple-50 text-purple-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <h3 className="text-2xl font-serif text-foreground mb-2">Belum ada request.</h3>
            <p className="text-foreground/60 font-sans max-w-md mx-auto">
              Saat ini belum ada permintaan editing dari klien. Request baru akan muncul di sini secara otomatis.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {requests.map((req) => (
              <div key={req.id} className="bg-surface border border-border rounded-3xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                <div className="p-6 border-b border-border/50 bg-surface-alt/30 flex justify-between items-start">
                  <div>
                    <h3 className="font-serif text-lg text-foreground mb-1">{req.clientName}</h3>
                    <p className="text-xs text-foreground/50 font-sans font-mono">{new Date(req.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
                
                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-4">
                    <p className="text-xs text-foreground/50 font-bold uppercase tracking-widest mb-2">Catatan Klien</p>
                    <div className="bg-background border border-border rounded-xl p-4 text-sm font-sans text-foreground/80 max-h-32 overflow-y-auto">
                      {req.notes ? req.notes : <span className="italic text-foreground/40">Tidak ada catatan khusus.</span>}
                    </div>
                  </div>

                  {(req.status === "In Progress" || req.status === "Selesai") && (
                    <div className="mb-6">
                      <label className="text-xs text-foreground/50 font-bold uppercase tracking-widest mb-2 block">
                        Upload / Link Foto Editan (Google Drive)
                      </label>
                      <div className="flex flex-col gap-2 mb-4">
                        <label className="w-full relative bg-surface-alt border-2 border-dashed border-border hover:border-purple-500/50 rounded-xl px-4 py-6 text-center cursor-pointer transition-colors group">
                          {uploadingFiles[req.id] ? (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-sm font-medium text-foreground/70">Mengunggah Foto...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                              </div>
                              <span className="text-sm font-medium text-foreground/70">Pilih Foto Editan (JPG/PNG)</span>
                              <span className="text-xs text-foreground/40">Otomatis masuk ke GDrive Klien</span>
                            </div>
                          )}
                          <input 
                            type="file" 
                            multiple 
                            accept="image/jpeg, image/png, image/webp"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => handleUploadFiles(e, req.id, req.projectId)}
                            disabled={uploadingFiles[req.id]}
                          />
                        </label>
                        
                        <div className="relative flex items-center py-2">
                          <div className="flex-grow border-t border-border"></div>
                          <span className="flex-shrink-0 mx-4 text-foreground/40 text-xs">ATAU PASTE LINK MANUAL</span>
                          <div className="flex-grow border-t border-border"></div>
                        </div>

                        <input 
                          type="url" 
                          placeholder="https://drive.google.com/..."
                          value={driveLinks[req.id] || ""}
                          onChange={(e) => setDriveLinks(prev => ({ ...prev, [req.id]: e.target.value }))}
                          className="w-full bg-background border border-border text-foreground text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-purple-500 transition-colors"
                        />
                      </div>

                      <button 
                        onClick={() => sendWhatsAppDirect(req)}
                        className="w-full py-2 bg-green-500/10 text-green-600 border border-green-500/20 rounded-lg text-sm font-medium hover:bg-green-500 hover:text-white transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Kirim via WhatsApp
                      </button>
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-auto">
                    {req.status === "Pending" && (
                      <button 
                        onClick={() => updateStatus(req.id, "In Progress")}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                      >
                        Kerjakan
                      </button>
                    )}
                    {req.status === "In Progress" && (
                      <button 
                        onClick={() => updateStatus(req.id, "Selesai", req.projectId)}
                        className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm cursor-pointer"
                      >
                        Tandai Selesai
                      </button>
                    )}
                    <Link 
                      href={`/client/${req.projectId}`}
                      target="_blank"
                      className="py-2.5 px-4 bg-surface-alt border border-border text-foreground rounded-lg text-sm font-medium hover:bg-surface transition-colors flex items-center justify-center cursor-pointer"
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
