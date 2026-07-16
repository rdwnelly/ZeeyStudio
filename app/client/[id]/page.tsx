"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  gdriveLinkWatermark: string;
  gdriveLinkHighRes: string;
  maxPhotos: number;
  createdAt: string;
  driveFolderId?: string;
  status?: 'Menunggu Pemilihan' | 'Selesai';
};

type Photo = {
  id: string;
  name: string;
  thumbnailUrl: string;
  fullUrl: string;
};

type PriceItem = {
  id: string;
  name: string;
  price: number;
  unit: string;
  isSystem?: boolean;
};

const DEFAULT_PRICELIST: PriceItem[] = [
  { id: "extra_photo", name: "Foto Tambahan", price: 50000, unit: "per foto", isSystem: true },
];

export default function ClientGallery({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // States for flow
  const [showInvoice, setShowInvoice] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPriceList, setShowPriceList] = useState(false);
  const [isScreenshotAttempted, setIsScreenshotAttempted] = useState(false);

  // Payment states
  const [qrisString, setQrisString] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [isMockPayment, setIsMockPayment] = useState(false);

  // Price List state
  const [priceList, setPriceList] = useState<PriceItem[]>(DEFAULT_PRICELIST);

  // States for long-press to view
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const startPress = (photo: Photo) => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setViewingPhoto(photo);
    }, 500);
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const endPress = (photoId: string) => {
    cancelPress();
    if (!isLongPress.current) {
      togglePhoto(photoId);
    }
    // reset after a tiny delay so click doesn't trigger
    setTimeout(() => { isLongPress.current = false; }, 100);
  };

  useEffect(() => {
    async function init() {
      try {
        // Get project from Firestore
        const docRef = doc(db, "projects", resolvedParams.id);
        const docSnap = await getDoc(docRef);
        
        let found: Project | null = null;
        if (docSnap.exists()) {
          found = { id: docSnap.id, ...docSnap.data() } as Project;
        } else {
          // Fallback to localStorage for older projects
          const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
          found = savedProjects.find((p: Project) => p.id === resolvedParams.id) || null;
        }

        // Get price list from localStorage
        const savedPriceList = JSON.parse(localStorage.getItem("zeey_pricelist") || "null");
        if (savedPriceList && savedPriceList.length > 0) {
          setPriceList(savedPriceList);
        }
        
        if (!found) {
          setIsLoading(false);
          return;
        }
        
        setProject(found);

      if (found.driveFolderId) {
        try {
          const res = await fetch(`/api/drive/list-photos?folderId=${found.driveFolderId}`);
          const data = await res.json();
          if (res.ok && data.success) {
            setPhotos(data.photos);
          } else {
            setErrorMsg(data.error || "Gagal memuat foto dari Google Drive");
          }
        } catch (err) {
          setErrorMsg("Terjadi kesalahan saat memuat foto");
        }
      }
      setIsLoading(false);
      } catch(e) {
        setErrorMsg("Gagal menghubungi server database");
        setIsLoading(false);
      }
    }
    
    init();

    // Listen to changes in localStorage from other tabs (Settings page)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "zeey_pricelist" && e.newValue) {
        try {
          const newPriceList = JSON.parse(e.newValue);
          if (newPriceList && newPriceList.length > 0) {
            setPriceList(newPriceList);
          }
        } catch (error) {
          console.error("Error parsing new price list from storage:", error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [resolvedParams.id]);

  useEffect(() => {
    // Detect keyboard shortcuts for screenshots
    const handleKeyDown = (e: KeyboardEvent) => {
      // Windows: PrintScreen
      // Mac: Cmd + Shift + 3 / 4 / 5
      // Snipping Tool: Win + Shift + S
      if (
        e.key === "PrintScreen" ||
        (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5" || e.key === "s" || e.key === "S")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "s" || e.key === "S"))
      ) {
        setIsScreenshotAttempted(true);
        // Reset warning after 3 seconds
        setTimeout(() => setIsScreenshotAttempted(false), 3000);
      }
    };

    // Detect when window loses focus (e.g. opening Snipping Tool)
    // We add a blur effect to the body
    const handleBlur = () => {
      document.body.style.filter = "blur(15px)";
    };

    const handleFocus = () => {
      document.body.style.filter = "none";
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.body.style.filter = "none";
    };
  }, []);

  const togglePhoto = (id: string) => {
    const newSet = new Set(selectedPhotos);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPhotos(newSet);
  };

  const handleConfirm = async () => {
    if (!project) return;
    
    if (selectedPhotos.size <= project.maxPhotos) {
      updateProjectStatusToSelesai();
      setShowSuccess(true);
    } else {
      setShowInvoice(true);
      await generateQris();
    }
  };

  const generateQris = async () => {
    if (!project) return;
    setIsPaymentLoading(true);
    const newOrderId = `INV-${project.id}-${Date.now()}`;
    setOrderId(newOrderId);
    setPaymentStatus('pending');
    
    try {
      const extraPhotosCount = Math.max(0, selectedPhotos.size - project.maxPhotos);
      const extraPhotoItem = priceList.find(item => item.id === "extra_photo");
      const activeExtraPhotoPrice = extraPhotoItem ? extraPhotoItem.price : 50000;
      const totalExtraCost = extraPhotosCount * activeExtraPhotoPrice;

      const res = await fetch('/api/payment/create-qris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: newOrderId,
          grossAmount: totalExtraCost,
          clientName: project.clientName,
          waNumber: project.waNumber
        })
      });
      const data = await res.json();
      if (data.success && data.qrString) {
        setQrisString(data.qrString);
        setIsMockPayment(data.isMock);
      } else {
        alert("Gagal memuat QRIS: " + (data.error || "Terjadi kesalahan"));
      }
    } catch (err) {
      alert("Gagal menghubungi server pembayaran");
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // Poll Payment Status
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (showInvoice && paymentStatus === 'pending' && orderId) {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`/api/payment/status?orderId=${orderId}&isMock=${isMockPayment}`);
          const data = await res.json();
          if (data.success && (data.transaction_status === 'settlement' || data.transaction_status === 'capture' || data.transaction_status === 'PAID')) {
            setPaymentStatus('settlement');
            handlePaymentSuccess();
          }
        } catch (error) {
          console.error("Error polling status:", error);
        }
      }, 3000); // Poll every 3 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [showInvoice, paymentStatus, orderId, isMockPayment]);

  const handlePaymentSuccess = () => {
    updateProjectStatusToSelesai();
    setShowInvoice(false);
    setShowSuccess(true);
  };

  const extraPhotoItem = priceList.find(item => item.id === "extra_photo");
  const activeExtraPhotoPrice = extraPhotoItem ? extraPhotoItem.price : 50000;
  
  const extraPhotosCount = project ? Math.max(0, selectedPhotos.size - project.maxPhotos) : 0;
  const totalExtraCost = extraPhotosCount * activeExtraPhotoPrice;

  const updateProjectStatusToSelesai = async () => {
    if (!project) return;
    try {
      await updateDoc(doc(db, "projects", project.id), {
        status: 'Selesai',
        extraRevenue: totalExtraCost,
        completedAt: new Date().toISOString()
      });
    } catch(e) {
      console.error(e);
    }

    // Update fallback localStorage
    const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
    const updatedProjects = savedProjects.map((p: Project) => {
      if (p.id === project.id) {
        return { 
          ...p, 
          status: 'Selesai',
          extraRevenue: totalExtraCost,
          completedAt: new Date().toISOString()
        };
      }
      return p;
    });
    localStorage.setItem("zeey_projects", JSON.stringify(updatedProjects));
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Memuat galeri...</div>;
  if (!project) return <div className="min-h-screen flex items-center justify-center">Project tidak ditemukan.</div>;


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
          Pembayaran berhasil dan pilihan foto Anda ({selectedPhotos.size} foto) telah dikonfirmasi. Anda dapat mengunduh foto beresolusi tinggi sekarang.
        </p>
        
        {project.gdriveLinkHighRes && (
          <Link
            href={project.gdriveLinkHighRes}
            target="_blank"
            className="bg-accent text-white px-8 py-4 rounded-xl font-medium hover:bg-accent-dark transition-colors shadow-lg font-sans mb-6 flex items-center gap-2 text-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            Unduh Foto Resolusi Tinggi
          </Link>
        )}

        <button 
          onClick={() => window.location.reload()}
          className="text-accent underline-offset-4 hover:underline"
        >
          Kembali ke Galeri
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Screenshot Warning Overlay */}
      {isScreenshotAttempted && (
        <div className="fixed inset-0 bg-black z-[99999] flex flex-col items-center justify-center text-white text-center p-6">
          <svg className="w-20 h-20 text-red-500 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          <h2 className="text-3xl font-serif mb-2">Tangkapan Layar Diblokir</h2>
          <p className="text-white/70 max-w-md">Demi melindungi hak cipta fotografer, tindakan tangkapan layar (screenshot) tidak diizinkan pada galeri ini.</p>
        </div>
      )}

      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex justify-between items-start w-full md:w-auto relative">
            <div>
              <h1 className="text-2xl text-foreground mb-1">{project.clientName}</h1>
              <p className="text-sm text-foreground/60 font-sans uppercase tracking-widest mb-1">Pemilihan Foto</p>
              <div className="flex gap-2 mb-2">
                <button 
                  onClick={() => setShowPriceList(true)}
                  className="text-xs bg-surface-alt hover:bg-border text-foreground/80 font-medium px-3 py-1.5 rounded-full border border-border transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                  Daftar Harga
                </button>
              </div>
              <p className="text-xs text-foreground/50 font-sans italic bg-surface-alt inline-block px-3 py-1 rounded-full border border-border">
                💡 Tips: Ketuk 1x untuk memilih. Tekan lama pada foto untuk melihat ukuran penuh.
              </p>
            </div>
            
            {/* Top Corner Mobile/Desktop Badge */}
            <div className={`absolute top-0 right-0 md:hidden px-3 py-1.5 rounded-lg text-xs font-bold font-sans shadow-lg transition-colors ${extraPhotosCount > 0 ? 'bg-accent text-white' : 'bg-surface-alt text-foreground/50 border border-border'}`}>
              Tagihan Ekstra:<br/>Rp {totalExtraCost.toLocaleString('id-ID')}
            </div>
          </div>
          
          <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 md:p-0 md:relative md:border-none md:bg-transparent z-50 flex justify-between md:justify-end items-center md:gap-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:shadow-none">
            <div className="text-left md:text-right flex flex-col justify-center">
              <div className="text-xs md:text-sm text-foreground/60 font-sans mb-0 md:mb-1">Foto Terpilih</div>
              <div className="text-xl md:text-2xl font-serif">
                <span className={selectedPhotos.size > project.maxPhotos ? "text-accent" : "text-foreground"}>
                  {selectedPhotos.size}
                </span>
                <span className="text-foreground/40 text-sm md:text-lg"> / {project.maxPhotos}</span>
              </div>
              {/* Automatic Calculation Display */}
              <div className={`text-xs md:text-sm font-bold font-sans mt-1 px-2 py-0.5 rounded transition-colors inline-block text-center ${extraPhotosCount > 0 ? 'bg-accent/10 text-accent' : 'bg-surface-alt text-foreground/40'}`}>
                + Rp {totalExtraCost.toLocaleString('id-ID')}
              </div>
            </div>
            <button 
              onClick={handleConfirm}
              disabled={selectedPhotos.size === 0}
              className="bg-accent text-white px-6 md:px-8 py-3 rounded-lg font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
            >
              Konfirmasi
            </button>
          </div>
        </div>
      </header>

      {/* Warning Banner if Over Limit */}
      {selectedPhotos.size > project.maxPhotos && (
        <div className="bg-accent/10 border-b border-accent/20 text-accent py-3 px-6 text-center text-sm font-sans flex flex-col md:flex-row items-center justify-center gap-2 animate-in slide-in-from-top-2">
          <span>Anda telah memilih <strong>{extraPhotosCount} foto tambahan</strong> dari batas paket.</span>
          <span className="hidden md:inline">•</span>
          <span className="font-bold">Total Tambahan: Rp {totalExtraCost.toLocaleString('id-ID')}</span>
        </div>
      )}

      {/* Gallery Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center mb-8">
            {errorMsg}
          </div>
        )}

        {!isLoading && photos.length === 0 && !errorMsg && (
          <div className="text-center py-20 bg-surface border border-dashed border-border rounded-xl">
            <svg className="w-16 h-16 text-border mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <h3 className="text-xl font-serif text-foreground mb-2">Belum ada foto</h3>
            <p className="text-foreground/60 max-w-md mx-auto">
              Fotografer belum mengunggah foto ke folder Anda. Silakan hubungi Zeey Studio.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-8 pb-20 md:pb-0">
          {photos.map((photo) => {
            const isSelected = selectedPhotos.has(photo.id);
            return (
              <div 
                key={photo.id} 
                onPointerDown={() => startPress(photo)}
                onPointerUp={() => endPress(photo.id)}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => { e.preventDefault(); cancelPress(); }}
                className={`relative aspect-[3/4] cursor-pointer group rounded-xl overflow-hidden transition-all duration-300 ${isSelected ? 'ring-4 ring-accent ring-offset-2 ring-offset-background scale-[0.98]' : 'hover:opacity-90 bg-surface-alt'}`}
              >
                {photo.thumbnailUrl ? (
                  <>
                    <img 
                      src={photo.thumbnailUrl} 
                      alt={photo.name} 
                      className="w-full h-full object-cover select-none pointer-events-none"
                      loading="lazy"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    />
                    {/* Watermark Overlay (Thumbnail) */}
                    <div className="absolute inset-0 z-[5] pointer-events-none flex items-center justify-center opacity-40">
                      <div className="text-white font-bold text-2xl whitespace-nowrap transform -rotate-45 tracking-widest select-none drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]">
                        ZEEY STUDIO
                      </div>
                    </div>
                    {/* Transparent overlay to block right click / long press saving on mobile */}
                    <div 
                      className="absolute inset-0 z-10"
                      onContextMenu={(e) => e.preventDefault()}
                    ></div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-border/30 text-foreground/40 text-sm p-4 text-center">
                    {photo.name}
                  </div>
                )}
                
                {/* Selection Indicator */}
                <div className={`absolute top-2 right-2 md:top-4 md:right-4 w-6 h-6 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center transition-colors z-20 ${isSelected ? 'bg-accent border-accent text-white' : 'border-white/70 bg-black/20 group-hover:bg-black/40'}`}>
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

      {/* Full Image Modal Overlay */}
      {viewingPhoto && (
        <div 
          className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300"
          onContextMenu={(e) => e.preventDefault()}
        >
          <button 
            onClick={() => setViewingPhoto(null)}
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 p-2 rounded-full z-50 cursor-pointer transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="relative w-full h-full max-w-5xl flex items-center justify-center overflow-hidden">
            {/* Using the proxy for the full image too to ensure it works securely */}
            <img 
              src={viewingPhoto.thumbnailUrl} 
              alt={viewingPhoto.name}
              className="max-w-full max-h-full object-contain select-none pointer-events-none"
              onDragStart={(e) => e.preventDefault()}
            />
            {/* Watermark Overlay (Full Screen) */}
            <div className="absolute inset-0 z-[5] pointer-events-none flex flex-col items-center justify-center opacity-30 overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="text-white font-bold text-4xl md:text-6xl whitespace-nowrap transform -rotate-45 mb-24 select-none drop-shadow-[0_0_12px_rgba(0,0,0,0.8)]">
                  ZEEY STUDIO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ZEEY STUDIO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ZEEY STUDIO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ZEEY STUDIO
                </div>
              ))}
            </div>
            {/* Transparent overlay for anti-download */}
            <div className="absolute inset-0 z-10" />
          </div>
          
          <div className="absolute bottom-6 left-0 right-0 text-center text-white/50 text-sm font-sans z-20 pointer-events-none">
            {viewingPhoto.name}
          </div>
        </div>
      )}

      {/* Invoice Modal Overlay */}
      {showInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <h2 className="text-3xl mb-2 font-serif">Foto Tambahan</h2>
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
                  <span className="text-foreground/70">Foto Tambahan ({extraPhotosCount} x Rp {activeExtraPhotoPrice.toLocaleString('id-ID')})</span>
                  <span className="font-medium">Rp {totalExtraCost.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-xl pt-2 font-serif">
                  <span>Total Tagihan</span>
                  <span className="text-accent">Rp {totalExtraCost.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* QRIS Placeholder */}
              <div className="bg-surface-alt border border-border p-6 rounded-xl flex flex-col items-center justify-center mb-8 min-h-[250px]">
                {isPaymentLoading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-sans text-foreground/60">Menyiapkan QRIS Midtrans...</p>
                  </div>
                ) : qrisString ? (
                  <>
                    <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                      <QRCodeSVG value={qrisString} size={200} />
                    </div>
                    {isMockPayment ? (
                      <p className="text-sm font-sans text-amber-600 text-center bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                        Mode Simulasi (Server Key Belum Diisi)
                      </p>
                    ) : (
                      <p className="text-sm font-sans text-foreground/60 text-center animate-pulse">
                        Menunggu pembayaran...
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-sans text-red-500">Gagal memuat kode QR</p>
                )}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowInvoice(false)}
                  className="flex-1 py-3 border border-border rounded-lg font-medium hover:bg-surface-alt transition-colors font-sans cursor-pointer"
                >
                  Tutup
                </button>
                {isMockPayment && (
                  <button 
                    onClick={handlePaymentSuccess}
                    className="flex-1 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-dark transition-colors font-sans shadow-md cursor-pointer"
                  >
                    Simulasi Berhasil
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price List Modal Overlay */}
      {showPriceList && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-border flex justify-between items-center bg-surface-alt/50">
              <h2 className="text-2xl font-serif">Daftar Harga Resmi</h2>
              <button 
                onClick={() => setShowPriceList(false)}
                className="text-foreground/50 hover:text-foreground cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {priceList.length === 0 ? (
                <p className="text-center text-foreground/60 font-sans py-4">Belum ada daftar harga.</p>
              ) : (
                <div className="space-y-4">
                  {priceList.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-4 bg-background border border-border rounded-xl">
                      <div>
                        <div className="font-medium text-foreground mb-1">{item.name}</div>
                        <div className="text-xs text-foreground/60 font-sans">{item.unit}</div>
                      </div>
                      <div className="font-bold text-accent font-sans">
                        Rp {item.price.toLocaleString("id-ID")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-border bg-surface-alt/30">
              <button 
                onClick={() => setShowPriceList(false)}
                className="w-full py-3 bg-foreground text-surface rounded-lg font-medium hover:bg-black transition-colors font-sans cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
