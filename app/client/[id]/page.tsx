"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  gdriveLink: string;
  maxPhotos: number;
  createdAt: string;
};

// High-quality mock photography images
const MOCK_PHOTOS = [
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=800&auto=format&fit=crop", // Wedding couple
  "https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop", // Wedding details
  "https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=800&auto=format&fit=crop", // Bride
  "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800&auto=format&fit=crop", // Wedding rings
  "https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=800&auto=format&fit=crop", // Fashion/Portrait
  "https://images.unsplash.com/photo-1509927083803-4bd519298ac4?q=80&w=800&auto=format&fit=crop", // Couple outdoor
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800&auto=format&fit=crop", // Portrait smiling
  "https://images.unsplash.com/photo-1522851486241-10d9c3bd1101?q=80&w=800&auto=format&fit=crop", // Lifestyle
  "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?q=80&w=800&auto=format&fit=crop", // Wedding toast
  "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?q=80&w=800&auto=format&fit=crop", // Editorial
];

// Replicate photos to make a larger gallery (30 items)
const GALLERY = [...MOCK_PHOTOS, ...MOCK_PHOTOS, ...MOCK_PHOTOS].map((url, i) => ({
  id: `photo-${i}`,
  url,
}));

const EXTRA_PHOTO_PRICE = 50000; // Rp 50.000 per extra photo

export default function ClientGallery({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  
  // States for flow
  const [showInvoice, setShowInvoice] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Simulate fetching data
    const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
    const found = savedProjects.find((p: Project) => p.id === resolvedParams.id);
    
    // For demo purposes, if not found, create a dummy one
    if (found) {
      setProject(found);
    } else {
      setProject({
        id: resolvedParams.id,
        clientName: "Demo Client",
        waNumber: "123",
        gdriveLink: "",
        maxPhotos: 15,
        createdAt: new Date().toISOString()
      });
    }
    setIsLoading(false);
  }, [resolvedParams.id]);

  const togglePhoto = (id: string) => {
    const newSet = new Set(selectedPhotos);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPhotos(newSet);
  };

  const handleConfirm = () => {
    if (!project) return;
    
    if (selectedPhotos.size <= project.maxPhotos) {
      setShowSuccess(true);
    } else {
      setShowInvoice(true);
    }
  };

  const handleSimulatePayment = () => {
    setShowInvoice(false);
    setShowSuccess(true);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Memuat galeri...</div>;
  if (!project) return <div className="min-h-screen flex items-center justify-center">Project tidak ditemukan.</div>;

  const extraPhotosCount = Math.max(0, selectedPhotos.size - project.maxPhotos);
  const totalExtraCost = extraPhotosCount * EXTRA_PHOTO_PRICE;

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h1 className="text-4xl mb-4">Terima Kasih, {project.clientName}!</h1>
        <p className="text-foreground/70 font-sans max-w-md mx-auto mb-8">
          Pilihan foto Anda ({selectedPhotos.size} foto) telah dikonfirmasi dan disimpan. Tim kami akan segera memproses foto-foto Anda.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="text-terracotta underline-offset-4 hover:underline"
        >
          Kembali ke Galeri
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl text-foreground mb-1">{project.clientName}</h1>
            <p className="text-sm text-foreground/60 font-sans uppercase tracking-widest">Pemilihan Foto</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-sm text-foreground/60 font-sans mb-1">Foto Terpilih</div>
              <div className="text-2xl font-serif">
                <span className={selectedPhotos.size > project.maxPhotos ? "text-terracotta" : "text-foreground"}>
                  {selectedPhotos.size}
                </span>
                <span className="text-foreground/40 text-lg"> / {project.maxPhotos}</span>
              </div>
            </div>
            <button 
              onClick={handleConfirm}
              disabled={selectedPhotos.size === 0}
              className="bg-foreground text-surface px-8 py-3 rounded-lg font-medium hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Konfirmasi Pilihan
            </button>
          </div>
        </div>
      </header>

      {/* Warning Banner if Over Limit */}
      {selectedPhotos.size > project.maxPhotos && (
        <div className="bg-terracotta/10 border-b border-terracotta/20 text-terracotta py-3 px-6 text-center text-sm font-sans animate-in slide-in-from-top-2">
          Anda telah memilih {extraPhotosCount} foto tambahan. Akan ada biaya tambahan yang berlaku.
        </div>
      )}

      {/* Gallery Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
          {GALLERY.map((photo) => {
            const isSelected = selectedPhotos.has(photo.id);
            return (
              <div 
                key={photo.id} 
                onClick={() => togglePhoto(photo.id)}
                className={`relative aspect-[3/4] cursor-pointer group rounded-xl overflow-hidden transition-all duration-300 ${isSelected ? 'ring-4 ring-terracotta ring-offset-2 ring-offset-background scale-[0.98]' : 'hover:opacity-90'}`}
              >
                <img 
                  src={photo.url} 
                  alt="Gallery image" 
                  className="w-full h-full object-cover"
                />
                
                {/* Selection Indicator */}
                <div className={`absolute top-4 right-4 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-terracotta border-terracotta text-white' : 'border-white/70 bg-black/20 group-hover:bg-black/40'}`}>
                  {isSelected && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Invoice Modal Overlay */}
      {showInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <h2 className="text-3xl mb-2">Foto Tambahan</h2>
              <p className="text-foreground/70 font-sans mb-8">
                Anda telah memilih lebih banyak foto dari batas paket Anda. Silakan selesaikan pembayaran untuk foto-foto tambahan.
              </p>
              
              <div className="space-y-4 mb-8 font-sans">
                <div className="flex justify-between text-sm pb-4 border-b border-border">
                  <span className="text-foreground/70">Batas Paket Termasuk</span>
                  <span className="font-medium">{project.maxPhotos} foto</span>
                </div>
                <div className="flex justify-between text-sm pb-4 border-b border-border">
                  <span className="text-foreground/70">Total Terpilih</span>
                  <span className="font-medium">{selectedPhotos.size} foto</span>
                </div>
                <div className="flex justify-between text-sm pb-4 border-b border-border">
                  <span className="text-foreground/70">Foto Tambahan ({extraPhotosCount} x Rp 50.000)</span>
                  <span className="font-medium">Rp {totalExtraCost.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-xl pt-2 font-serif">
                  <span>Total Tagihan</span>
                  <span className="text-terracotta">Rp {totalExtraCost.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* QRIS Placeholder */}
              <div className="bg-surface-alt border border-border p-6 rounded-xl flex flex-col items-center justify-center mb-8">
                <div className="w-40 h-40 bg-white border-2 border-border p-2 rounded-lg mb-4 flex items-center justify-center">
                  <div className="text-center text-border text-sm font-sans">
                    [ GAMBAR KODE QRIS ]
                  </div>
                </div>
                <p className="text-sm font-sans text-foreground/60 text-center">Pindai untuk membayar dengan aplikasi yang didukung</p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowInvoice(false)}
                  className="flex-1 py-3 border border-border rounded-lg font-medium hover:bg-surface-alt transition-colors font-sans cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSimulatePayment}
                  className="flex-1 py-3 bg-terracotta text-white rounded-lg font-medium hover:bg-terracotta-dark transition-colors font-sans shadow-[0_4px_14px_0_rgba(200,107,94,0.39)] cursor-pointer"
                >
                  Simulasikan Pembayaran Berhasil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
