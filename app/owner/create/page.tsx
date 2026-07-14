"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  gdriveLinkHighRes: string;
  maxPhotos: number;
  createdAt: string;
  driveFolderId?: string;
  status?: 'Menunggu Pemilihan' | 'Selesai';
};

export default function AdminPage() {
  const [clientName, setClientName] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [gdriveLinkHighRes, setGdriveLinkHighRes] = useState("");
  const [maxPhotos, setMaxPhotos] = useState<number | "">("");

  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedProject, setGeneratedProject] = useState<Project | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    
    // Generate short professional ID (e.g., "john-jane-a4b2")
    const slug = clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const shortHash = Math.random().toString(36).substring(2, 6);
    const id = slug ? `${slug}-${shortHash}` : shortHash;
    
    const extractDriveFolderId = (url: string) => {
      if (!url) return "";
      const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
      return match ? match[1] : "";
    };

    const extractedFolderId = extractDriveFolderId(gdriveLinkHighRes);

    const newProject: Project = {
      id,
      clientName,
      waNumber,
      gdriveLinkHighRes,
      maxPhotos: Number(maxPhotos),
      createdAt: new Date().toISOString(),
      driveFolderId: extractedFolderId,
      status: 'Menunggu Pemilihan',
    };

    try {
      if (extractedFolderId) {
        setDriveFolderId(extractedFolderId);
      }

      // Save to localStorage
      const existingProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
      localStorage.setItem("zeey_projects", JSON.stringify([...existingProjects, newProject]));

      // Generate Client Link
      const link = `${window.location.origin}/client/${id}`;
      setGeneratedLink(link);
      setGeneratedProject(newProject);
      
      // Reset form
      setClientName("");
      setWaNumber("");
      setGdriveLinkHighRes("");
      setMaxPhotos("");
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const createWhatsAppLink = () => {
    if (!generatedProject) return "";
    let cleanNumber = generatedProject.waNumber.replace(/[^0-9]/g, "");
    if (cleanNumber.startsWith("0")) {
      cleanNumber = "62" + cleanNumber.substring(1);
    }
    const message = `Halo ${generatedProject.clientName},\n\nGaleri foto Anda sudah siap untuk dipilih! Anda dapat memilih hingga ${generatedProject.maxPhotos} foto.\n\nSilakan akses galeri Anda di sini: ${generatedLink}\n\nTerima kasih,\nZeey Studio`;
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  };

  return (
    <Sidebar>
      <div className="p-6 md:p-10 max-w-2xl mx-auto w-full">
        <div className="mb-10 border-b border-border pb-6">
          <h1 className="text-3xl md:text-4xl text-foreground mb-2">Portal Admin</h1>
          <p className="text-foreground/70 font-sans">Buat project klien baru dan hasilkan tautan pemilihan foto.</p>
        </div>

        <div className="bg-surface border border-border p-6 md:p-8 rounded-2xl shadow-md">
          <h2 className="text-2xl font-serif mb-6 border-b border-border pb-4">Project Klien Baru</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="clientName">Nama Klien</label>
              <input 
                id="clientName"
                type="text" 
                required
                className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-accent transition-colors"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g., John & Jane Wedding"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="waNumber">WhatsApp Number</label>
              <input 
                id="waNumber"
                type="tel" 
                required
                className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-accent transition-colors"
                value={waNumber}
                onChange={(e) => setWaNumber(e.target.value)}
                placeholder="e.g., +628123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="gdriveLinkHighRes">Google Drive Link (Folder Foto)</label>
              <div className="bg-surface-alt p-3 rounded-lg border border-border mb-3 font-sans text-sm">
                <p className="font-semibold mb-1 text-accent">⚠️ Penting: Akses Google Drive</p>
                <p className="text-foreground/70 mb-2">Agar aplikasi dapat membaca foto Anda, pastikan folder Google Drive tersebut dibagikan (Share) sebagai "Viewer/Pelihat" ke email sistem kami:</p>
                <code className="block bg-background p-2 rounded border border-border text-xs break-all select-all">
                  zeeystudio-drive-integration@zeeystudio-502410.iam.gserviceaccount.com
                </code>
              </div>
              <input 
                id="gdriveLinkHighRes"
                type="url" 
                required
                className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-accent transition-colors"
                value={gdriveLinkHighRes}
                onChange={(e) => setGdriveLinkHighRes(e.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="maxPhotos">Batas Maksimal Foto</label>
              <input 
                id="maxPhotos"
                type="number" 
                required
                min="1"
                className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-accent transition-colors"
                value={maxPhotos}
                onChange={(e) => setMaxPhotos(Number(e.target.value))}
                placeholder="e.g., 50"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {errorMsg}
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-accent text-white py-4 rounded-lg font-medium hover:bg-accent-dark transition-colors mt-4 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed shadow-md"
            >
              {isSubmitting ? 'Memproses...' : 'Buat Tautan Klien'}
            </button>
          </form>

          {generatedLink && (
            <div className="mt-10 p-6 bg-surface-alt border border-border rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-lg font-serif mb-2">Project Berhasil Dibuat!</h3>
              
              {driveFolderId && (
                <div className="mb-4 text-xs font-sans text-green-700 bg-green-100 p-2 rounded inline-block">
                  ✓ ID Folder berhasil dideteksi: {driveFolderId}
                </div>
              )}

              <p className="text-sm text-foreground/70 mb-4">Bagikan tautan unik ini kepada klien Anda:</p>
              
              <div className="flex items-center gap-2 mb-6">
                <input 
                  type="text" 
                  readOnly 
                  value={generatedLink} 
                  className="w-full p-3 bg-white border border-border rounded-lg text-sm text-foreground/80 outline-none"
                />
                <button 
                  onClick={() => navigator.clipboard.writeText(generatedLink)}
                  className="p-3 border border-border rounded-lg hover:bg-border transition-colors whitespace-nowrap text-sm cursor-pointer"
                >
                  Salin
                </button>
              </div>

              <div className="flex gap-4 flex-col sm:flex-row">
                <a 
                  href={createWhatsAppLink()} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#25D366] text-white text-center py-3 rounded-lg font-medium hover:bg-[#20bd5a] transition-colors"
                >
                  Kirim via WhatsApp
                </a>
                <Link
                  href={new URL(generatedLink).pathname}
                  target="_blank"
                  className="flex-1 bg-foreground text-surface text-center py-3 rounded-lg font-medium hover:bg-black transition-colors"
                >
                  Pratinjau Galeri
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
