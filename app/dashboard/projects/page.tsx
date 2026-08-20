"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import MultiTokenModal, { SubToken } from "@/components/MultiTokenModal";
import { formatGDriveUrl } from "@/lib/drive-utils";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  gdriveLinkHighRes?: string;
  maxPhotos: number;
  subTokens?: SubToken[];
  createdAt: string;
  gdriveFolderId?: string;
  status?: string;
  paymentProofStatus?: 'pending' | 'verified' | 'rejected';
};

export default function ActiveProjectsPage() {
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [completedProjects, setCompletedProjects] = useState<Project[]>([]);
  const [sendingWAId, setSendingWAId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [multiTokenProject, setMultiTokenProject] = useState<Project | null>(null);
  const [isMultiTokenOpen, setIsMultiTokenOpen] = useState(false);

  const fetchProjects = async () => {
    try {
      const snap = await getDocs(collection(db, "projects"));
      const fsProjects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      const localProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]") as Project[];
      
      const map = new Map<string, Project>();
      localProjects.forEach(p => map.set(p.id, p));
      fsProjects.forEach(p => map.set(p.id, p));
      
      const allProjects = Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActiveProjects(allProjects.filter((p: Project) => p.status !== 'Selesai' && p.status !== 'File Terkirim'));
      setCompletedProjects(allProjects.filter((p: Project) => p.status === 'Selesai' || p.status === 'File Terkirim'));
    } catch (e) {
      console.error("Gagal memuat proyek dari Firestore:", e);
      const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
      const sortedProjects = savedProjects.sort((a: Project, b: Project) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActiveProjects(sortedProjects.filter((p: Project) => p.status !== 'Selesai'));
      setCompletedProjects(sortedProjects.filter((p: Project) => p.status === 'Selesai'));
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSendWAReminder = async (project: Project) => {
    const message = `Halo ${project.clientName},\n\nKami mengingatkan bahwa Anda memiliki foto yang belum dipilih.\nSilakan segera memilih foto Anda melalui link galeri Anda agar tim kami dapat segera memprosesnya.\n\nTerima kasih,\nZeey Studio`;
    let cleanNumber = project.waNumber.replace(/[^0-9]/g, "");
    if (cleanNumber.startsWith("0")) {
        cleanNumber = "62" + cleanNumber.substring(1);
    }
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleSendWADownloadLink = (project: Project) => {
    if (!project.waNumber) {
      alert("Nomor WhatsApp klien tidak tersedia.");
      return;
    }
    let cleanNumber = project.waNumber.replace(/[^0-9]/g, "");
    if (cleanNumber.startsWith("0")) {
      cleanNumber = "62" + cleanNumber.substring(1);
    }
    const link = `${window.location.origin}/client/${project.id}`;
    let message = "";
    if (project.status === 'Selesai' || project.status === 'File Terkirim' || project.paymentProofStatus === 'verified') {
      message = `Halo ${project.clientName},\n\nPembayaran Anda telah berhasil diverifikasi oleh Admin!\n\nSilakan akses dan unduh foto Anda melalui tautan galeri berikut:\n${link}\n\nTerima kasih telah mempercayakan momen berharga Anda pada Zeey Studio!`;
    } else {
      message = `Halo ${project.clientName},\n\nBerikut adalah tautan galeri Anda di Zeey Studio untuk melihat & mengunduh foto:\n${link}\n\nTerima kasih,\nZeey Studio`;
    }
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleCopyLink = (id: string) => {
    const link = `${window.location.origin}/client/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus proyek klien "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      try {
        const { deleteDoc, doc } = await import("firebase/firestore");
        await deleteDoc(doc(db, "projects", id));

        try {
          const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
          const updatedLocal = savedProjects.filter((p: any) => p.id !== id);
          localStorage.setItem("zeey_projects", JSON.stringify(updatedLocal));
        } catch (e) {
          console.warn("Notice updating local storage on delete project:", e);
        }
        
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Hapus Pesanan", `Menghapus pesanan/proyek klien ${name} (${id})`);
        
        alert("Proyek berhasil dihapus.");
        fetchProjects();
      } catch (err) {
        console.error("Gagal menghapus", err);
        alert("Gagal menghapus proyek.");
      }
    }
  };

  return (
    <Sidebar>
      <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="mb-10 border-b border-border pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl md:text-4xl text-foreground mb-2">Manajemen Proyek</h1>
            <p className="text-foreground/70 font-sans">Pantau klien yang belum selesai dan riwayat proyek yang sudah lunas</p>
          </div>
          <Link
            href="/owner/create"
            className="bg-accent text-white px-6 py-3 rounded-lg font-medium hover:bg-accent-dark transition-colors shadow-md text-sm"
          >
            + Project Baru
          </Link>
        </div>

        {/* Active Projects Dashboard */}
        <div className="bg-surface border border-border rounded-2xl shadow-md overflow-hidden">
          <div className="p-6 border-b border-border flex justify-between items-center bg-surface-alt/30">
            <h2 className="text-xl font-serif">Daftar Proyek Aktif</h2>
            <span className="text-sm text-foreground/60 font-sans">Menunggu Pemilihan ({activeProjects.length})</span>
          </div>
          
          <div className="p-6">
            {activeProjects.length === 0 ? (
              <div className="text-center py-10 text-foreground/50 font-sans flex flex-col items-center">
                <svg className="w-16 h-16 text-border mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path></svg>
                <p>Tidak ada proyek aktif yang menunggu pemilihan saat ini.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeProjects.map(project => {
                  const daysElapsed = (Date.now() - new Date(project.createdAt).getTime()) / (1000 * 3600 * 24);
                  const isOverdue = daysElapsed >= 3;
                  
                  return (
                    <div key={project.id} className={`p-5 rounded-xl border ${isOverdue ? 'bg-pink-50 border-pink-200' : 'bg-background border-border'} transition-colors`}>
                      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-lg">{project.clientName}</h3>
                            {isOverdue && (
                              <span className="text-xs font-medium px-2 py-1 bg-pink-100 text-pink-700 rounded-full border border-pink-200 animate-pulse">
                                Lebih dari 3 Hari!
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground/60 mb-1">{project.waNumber}</p>
                          <p className="text-xs text-foreground/50">
                            Dibuat pada: {new Date(project.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              setMultiTokenProject(project);
                              setIsMultiTokenOpen(true);
                            }}
                            className="px-4 py-2 border border-accent/30 bg-accent/10 text-accent rounded-lg text-sm font-semibold hover:bg-accent/20 transition-colors text-center flex items-center gap-1.5 cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                            {project.subTokens && project.subTokens.length > 0 ? `Sub-Token (${project.subTokens.length})` : 'Bagi Token Link'}
                          </button>
                          <button
                            onClick={() => handleCopyLink(project.id)}
                            className="px-4 py-2 border border-border bg-white rounded-lg text-sm font-medium hover:bg-surface-alt transition-colors text-center flex items-center gap-2 cursor-pointer"
                          >
                            {copiedId === project.id ? (
                              <span className="text-green-600 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                Tersalin
                              </span>
                            ) : (
                              "Salin Link"
                            )}
                          </button>
                          <Link
                            href={`/client/${project.id}`}
                            target="_blank"
                            className="px-4 py-2 border border-border bg-white rounded-lg text-sm font-medium hover:bg-surface-alt transition-colors text-center flex items-center gap-1"
                          >
                            <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            Galeri
                          </Link>
                          <button
                            onClick={() => handleSendWADownloadLink(project)}
                            className="px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors text-center flex items-center gap-1.5 cursor-pointer"
                            title="Kirim Link Download Foto via WhatsApp"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            Kirim Link WA
                          </button>
                          {project.gdriveLinkHighRes && (
                            <a
                              href={formatGDriveUrl(project.gdriveLinkHighRes)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors text-center flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>
                              GDrive
                            </a>
                          )}
                          {isOverdue && (
                            <button
                              onClick={() => handleSendWAReminder(project)}
                              disabled={sendingWAId === project.id}
                              className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700 transition-colors disabled:opacity-50 cursor-pointer text-center"
                            >
                              {sendingWAId === project.id ? 'Mengirim...' : 'Kirim WA Pengingat'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(project.id, project.clientName)}
                            className="p-2 border border-border bg-white text-foreground/50 hover:text-red-600 hover:border-red-300 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Proyek"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Completed Projects Dashboard */}
        <div className="bg-surface border border-border rounded-2xl shadow-md overflow-hidden mt-8">
          <div className="p-6 border-b border-border flex justify-between items-center bg-green-50/50">
            <h2 className="text-xl font-serif text-green-800">Riwayat Proyek Selesai</h2>
            <span className="text-sm text-green-600 font-sans font-medium">Lunas ({completedProjects.length})</span>
          </div>
          
          <div className="p-6">
            {completedProjects.length === 0 ? (
              <div className="text-center py-10 text-foreground/50 font-sans flex flex-col items-center">
                <svg className="w-16 h-16 text-border mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 13l4 4L19 7"></path></svg>
                <p>Belum ada proyek yang selesai.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedProjects.map(project => (
                  <div key={project.id} className="p-5 rounded-xl border border-green-200 bg-green-50/30 transition-colors">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-lg">{project.clientName}</h3>
                          <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full border border-green-200">
                            Selesai & Lunas
                          </span>
                        </div>
                        <p className="text-sm text-foreground/60 mb-1">{project.waNumber}</p>
                        <p className="text-xs text-foreground/50">
                          Dibuat pada: {new Date(project.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleCopyLink(project.id)}
                          className="px-4 py-2 border border-border bg-white rounded-lg text-sm font-medium hover:bg-surface-alt transition-colors text-center flex items-center gap-2 cursor-pointer"
                        >
                          {copiedId === project.id ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                              Tersalin
                            </span>
                          ) : (
                            "Salin Link"
                          )}
                        </button>
                        <Link
                          href={`/client/${project.id}`}
                          target="_blank"
                          className="px-4 py-2 border border-border bg-white rounded-lg text-sm font-medium hover:bg-surface-alt transition-colors text-center flex items-center gap-1"
                        >
                          <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          Lihat Galeri
                        </Link>
                        <button
                          onClick={() => handleSendWADownloadLink(project)}
                          className="px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors text-center flex items-center gap-1.5 cursor-pointer"
                          title="Kirim Link Download Foto via WhatsApp"
                        >
                          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                          Kirim Link WA
                        </button>
                        {project.gdriveLinkHighRes && (
                          <a
                            href={formatGDriveUrl(project.gdriveLinkHighRes)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors text-center flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>
                            GDrive (High Res)
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <MultiTokenModal
        isOpen={isMultiTokenOpen}
        onClose={() => setIsMultiTokenOpen(false)}
        project={multiTokenProject}
        onProjectUpdated={fetchProjects}
      />
    </Sidebar>
  );
}
