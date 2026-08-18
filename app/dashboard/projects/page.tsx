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

  const handleCopyLink = (id: string) => {
    const link = `${window.location.origin}/client/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
