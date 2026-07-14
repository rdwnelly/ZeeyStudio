"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  gdriveLink: string;
  maxPhotos: number;
  createdAt: string;
};

export default function AdminPage() {
  const [clientName, setClientName] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [gdriveLink, setGdriveLink] = useState("");
  const [maxPhotos, setMaxPhotos] = useState<number | "">("");

  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedProject, setGeneratedProject] = useState<Project | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate UUID-like ID
    const id = crypto.randomUUID();
    
    const newProject: Project = {
      id,
      clientName,
      waNumber,
      gdriveLink,
      maxPhotos: Number(maxPhotos),
      createdAt: new Date().toISOString()
    };

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
    setGdriveLink("");
    setMaxPhotos("");
  };

  const createWhatsAppLink = () => {
    if (!generatedProject) return "";
    const message = `Halo ${generatedProject.clientName},\n\nGaleri foto Anda sudah siap untuk dipilih! Anda dapat memilih hingga ${generatedProject.maxPhotos} foto.\n\nSilakan akses galeri Anda di sini: ${generatedLink}\n\nTerima kasih,\nZeey Studio`;
    return `https://wa.me/${generatedProject.waNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-background p-8 md:p-12 lg:p-24 flex justify-center">
      <div className="max-w-2xl w-full">
        <div className="mb-10 text-center">
          <h1 className="text-4xl text-foreground mb-4">Portal Admin</h1>
          <p className="text-foreground/70 font-sans">Buat project klien baru dan hasilkan tautan pemilihan foto.</p>
        </div>

        <div className="bg-surface border border-border p-8 rounded-xl shadow-sm">
          <h2 className="text-2xl mb-6 border-b border-border pb-4">Project Klien Baru</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="clientName">Nama Klien</label>
              <input 
                id="clientName"
                type="text" 
                required
                className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-terracotta transition-colors"
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
                className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-terracotta transition-colors"
                value={waNumber}
                onChange={(e) => setWaNumber(e.target.value)}
                placeholder="e.g., +628123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" htmlFor="gdriveLink">Tautan Google Drive (Foto Mentah)</label>
              <input 
                id="gdriveLink"
                type="url" 
                required
                className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-terracotta transition-colors"
                value={gdriveLink}
                onChange={(e) => setGdriveLink(e.target.value)}
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
                className="w-full p-3 border border-border rounded-lg bg-background focus:outline-none focus:border-terracotta transition-colors"
                value={maxPhotos}
                onChange={(e) => setMaxPhotos(Number(e.target.value))}
                placeholder="e.g., 50"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-terracotta text-white py-4 rounded-lg font-medium hover:bg-terracotta-dark transition-colors mt-4 cursor-pointer"
            >
              Buat Tautan Klien
            </button>
          </form>

          {generatedLink && (
            <div className="mt-10 p-6 bg-surface-alt border border-border rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-lg font-serif mb-2">Project Berhasil Dibuat!</h3>
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
        
        <div className="mt-8 text-center flex gap-4 justify-center">
          <Link href="/owner" className="text-sm text-foreground/60 hover:text-terracotta underline-offset-4 hover:underline">
            ← Ke Portal Owner
          </Link>
          <span className="text-border">|</span>
          <Link href="/" className="text-sm text-foreground/60 hover:text-terracotta underline-offset-4 hover:underline">
            Ke Halaman Utama
          </Link>
        </div>
      </div>
    </div>
  );
}
