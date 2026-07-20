"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, updateDoc, doc, orderBy } from "firebase/firestore";

type Project = {
  id: string;
  clientName: string;
  status: string;
  gdriveLinkHighRes?: string;
  gdriveFolderId?: string;
  shootDate?: string;
};

export default function UploadPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data: Project[] = [];
      
      snapshot.forEach((doc) => {
        const p = { id: doc.id, ...doc.data() } as Project;
        // Ambil data dari daftar Pesanan Aktif (semua yang belum File Terkirim)
        if (p.status !== 'File Terkirim') {
          data.push(p);
        }
      });
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert("Pilih proyek klien terlebih dahulu!");
      return;
    }
    if (!selectedFiles || selectedFiles.length === 0) {
      alert("Pilih minimal satu foto untuk diunggah!");
      return;
    }

    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let folderId = project.gdriveFolderId;
      let finalLinkHighRes = project.gdriveLinkHighRes || "";

      // Create folder if it doesn't exist
      if (!folderId) {
        setUploadStatus("Membuat folder GDrive otomatis...");
        const folderRes = await fetch('/api/drive/create-project-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName: project.clientName })
        });
        const folderData = await folderRes.json();
        
        if (!folderData.success || !folderData.folderId) {
          throw new Error(folderData.error || "Gagal membuat folder Google Drive.");
        }
        
        folderId = folderData.folderId;
        finalLinkHighRes = `https://drive.google.com/drive/folders/${folderId}`;
      }

      // Upload files
      for (let i = 0; i < selectedFiles.length; i++) {
        setUploadStatus(`Mengunggah foto (${i + 1}/${selectedFiles.length})...`);
        setUploadProgress(((i + 1) / selectedFiles.length) * 100);
        
        const formData = new FormData();
        formData.append('file', selectedFiles[i]);
        formData.append('folderId', folderId as string);
        
        const uploadRes = await fetch('/api/drive/upload', {
          method: 'POST',
          body: formData,
        });
        
        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          console.error(`Gagal upload file ke-${i+1}:`, uploadData.error);
        }
      }

      setUploadStatus("Memperbarui status proyek...");
      
      // Update the project with the folder link and ID, set status to Menunggu Pemilihan
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, "projects", selectedProjectId), {
        gdriveLinkHighRes: finalLinkHighRes,
        gdriveFolderId: folderId,
        status: 'Menunggu Pemilihan' // Auto move to selection
      });
      
      const { logActivity } = await import("@/lib/audit");
      await logActivity("Upload Foto", `Mengunggah ${selectedFiles.length} foto mentah untuk ${project.clientName}`);

      setUploadStatus("Selesai!");
      alert(`Berhasil mengunggah ${selectedFiles.length} foto ke GDrive klien!`);
      
      // Reset
      setSelectedFiles(null);
      setSelectedProjectId("");
      fetchProjects(); // Refresh list
    } catch (err: any) {
      console.error(err);
      alert("Terjadi kesalahan: " + (err.message || "Unknown error"));
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadStatus("");
        setUploadProgress(0);
      }, 1500);
    }
  };

  return (
    <Sidebar>
      <div className="p-4 md:p-8 lg:p-10 max-w-4xl mx-auto w-full pb-24 animate-in fade-in duration-500">
        <div className="mb-8 border-b border-border/50 pb-6">
          <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">
            Upload Foto Klien
          </h1>
          <p className="text-foreground/70 font-sans text-sm md:text-base">
            Halaman khusus untuk mengunggah foto sesi pemotretan langsung ke Google Drive klien.
          </p>
        </div>

        <div className="bg-surface border border-border p-6 md:p-10 rounded-3xl shadow-sm">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <form onSubmit={handleUpload} className="space-y-8">
              {/* Bagian 1: Pilih Klien */}
              <div>
                <label className="block text-sm font-medium mb-3 text-foreground/80 uppercase tracking-wider">
                  1. Pilih Proyek / Klien
                </label>
                <select 
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  disabled={isUploading}
                  className="w-full bg-background border border-border text-foreground rounded-xl px-4 py-4 focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer font-medium"
                >
                  <option value="" disabled>-- Klik untuk Memilih Klien --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.clientName} - {p.shootDate ? new Date(p.shootDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : 'Jadwal belum diatur'} ({p.status})
                    </option>
                  ))}
                </select>
                {projects.length === 0 && (
                  <p className="text-xs text-red-500 mt-2">Belum ada pesanan aktif saat ini.</p>
                )}
              </div>

              {/* Bagian 2: Pilih Foto */}
              <div className={!selectedProjectId ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                <label className="block text-sm font-medium mb-3 text-foreground/80 uppercase tracking-wider">
                  2. Pilih Foto yang Akan Diunggah
                </label>
                
                <label className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-border border-dashed rounded-2xl bg-surface-alt/50 hover:bg-surface-alt hover:border-accent/50 transition-colors cursor-pointer group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-12 h-12 mb-4 text-foreground/40 group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    <p className="mb-2 text-sm text-foreground/70 font-medium">
                      <span className="font-semibold text-accent">Klik untuk memilih</span> atau seret (drag) foto ke area ini
                    </p>
                    <p className="text-xs text-foreground/50">Mendukung file JPG, PNG, WebP (Bisa pilih banyak sekaligus)</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    multiple 
                    accept="image/jpeg, image/png, image/webp"
                    onChange={(e) => setSelectedFiles(e.target.files)}
                    disabled={isUploading || !selectedProjectId}
                  />
                </label>

                {selectedFiles && selectedFiles.length > 0 && (
                  <div className="mt-4 p-4 bg-accent/5 border border-accent/20 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{selectedFiles.length} file dipilih</p>
                        <p className="text-xs text-foreground/60">Siap untuk diunggah ke Google Drive</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSelectedFiles(null)}
                      className="text-sm text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      disabled={isUploading}
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>

              {/* Bagian 3: Tombol Eksekusi */}
              <div className="pt-4 border-t border-border/50">
                <button 
                  type="submit"
                  disabled={isUploading || !selectedProjectId || !selectedFiles || selectedFiles.length === 0}
                  className="w-full bg-accent text-white py-4 rounded-xl font-medium hover:bg-accent-dark transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md relative overflow-hidden"
                >
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-white/25 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isUploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        {uploadStatus || 'Memproses...'}
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Mulai Upload ke GDrive
                      </>
                    )}
                  </span>
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
