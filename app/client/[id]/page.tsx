"use client";

import { useState, useEffect, use, useRef, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, onSnapshot } from "firebase/firestore";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  gdriveLinkWatermark: string;
  gdriveLinkHighRes: string;
  maxPhotos: number;
  createdAt: string;
  gdriveFolderId?: string;
  status?: string;
  packagePrice?: number;
  packageName?: string;
  dpAmount?: number;
  pendingPayment?: { orderId: string; amount: number; createdAt: string };
  selectedPhotoIds?: string[];  // disimpan saat pembayaran selesai
  completedAt?: string;
  paymentProofUrl?: string;
  paymentProofStatus?: 'pending' | 'verified' | 'rejected';
  createdBy?: string;
  assignedAdmin?: string;
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
  scheme?: 'berbayar' | 'sudah bayar';
};

const DEFAULT_PRICELIST: PriceItem[] = [
  { id: "extra_photo", name: "Foto Tambahan", price: 50000, unit: "per foto", isSystem: true },
];

// Advanced Secure Image Component to prevent DevTools tampering
const SecureImage = memo(({ src, alt, isFullscreen = false }: { src: string, alt: string, isFullscreen?: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // MutationObserver to detect if someone deletes the watermark overlay in DevTools
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.removedNodes.length > 0) {
          // If any node is removed (like the watermark div), hide the whole container
          if (containerRef.current) {
            containerRef.current.style.display = 'none';
            alert("Tindakan ilegal terdeteksi (Anti-Theft).");
          }
        }
      });
    });

    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
      <img 
        src={src} 
        alt={alt} 
        className={`${isFullscreen ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-cover'} select-none pointer-events-none`}
        loading="lazy"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
      {/* Heavy Repeating Watermark */}
      <div className="absolute inset-0 z-[5] pointer-events-none flex flex-col items-center justify-center opacity-30 overflow-hidden mix-blend-overlay">
        {Array.from({ length: isFullscreen ? 15 : 5 }).map((_, i) => (
          <div key={i} className={`text-white font-bold ${isFullscreen ? 'text-4xl md:text-6xl mb-24' : 'text-2xl mb-8'} whitespace-nowrap transform -rotate-45 tracking-widest select-none drop-shadow-[0_0_8px_rgba(0,0,0,0.9)]`}>
            ZEEY STUDIO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ZEEY STUDIO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ZEEY STUDIO
          </div>
        ))}
      </div>
      {/* Invisible overlay blocking interaction */}
      <div className="absolute inset-0 z-10" onContextMenu={(e) => e.preventDefault()}></div>
    </div>
  );
});
SecureImage.displayName = "SecureImage";

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
  
  // Editor Request states
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorNotes, setEditorNotes] = useState("");
  const [isSubmittingEditor, setIsSubmittingEditor] = useState(false);
  const [editorRequestSuccess, setEditorRequestSuccess] = useState(false);

  // Payment states
  const [qrisString, setQrisString] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [isMockPayment, setIsMockPayment] = useState(false);
  const [studioWaUrl, setStudioWaUrl] = useState<string | null>(null);

  // ZIP Download state
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  // Price List & Addons state
  const [priceList, setPriceList] = useState<PriceItem[]>(DEFAULT_PRICELIST);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});

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

        // Get price list from Firestore
        const priceSnap = await getDocs(collection(db, "pricelist"));
        const pricesMap = new Map<string, PriceItem>();
        if (!priceSnap.empty) {
          priceSnap.docs.forEach(d => {
            const data = d.data();
            const itemId = data.id || d.id;
            if (!pricesMap.has(itemId)) {
              pricesMap.set(itemId, { ...data, id: itemId } as PriceItem);
            }
          });
        }
        
        // Ensure System items exist even if not in DB yet
        const defaultSystemPrices: PriceItem[] = [
          { id: "extra_photo", name: "Foto Tambahan", price: 50000, unit: "per foto", isSystem: true },
          { id: "editor_request", name: "Jasa Editor (Retouch)", price: 100000, unit: "per request", isSystem: true }
        ];
        defaultSystemPrices.forEach(def => {
          if (!pricesMap.has(def.id)) {
            pricesMap.set(def.id, def);
          }
        });

        const prices = Array.from(pricesMap.values());
        prices.sort((a, b) => (a.isSystem === b.isSystem ? 0 : a.isSystem ? -1 : 1));
        setPriceList(prices);
        
        if (!found) {
          setIsLoading(false);
          return;
        }

        setProject(found);

        // Coba pre-fetch nomor WA untuk tombol konfirmasi manual agar tidak kena popup blocker
        try {
          let wa = "";
          const profileSnap = await getDoc(doc(db, "settings", "profile"));
          if (profileSnap.exists() && profileSnap.data().waNumber) {
            wa = profileSnap.data().waNumber;
          }
          if (!wa) {
            const adminsSnap = await getDocs(collection(db, "admins"));
            adminsSnap.forEach(d => {
              const adminData = d.data();
              if (adminData.waNumber) {
                if (adminData.username === found.createdBy || adminData.username === found.assignedAdmin) {
                  wa = adminData.waNumber;
                } else if (!wa) {
                  wa = adminData.waNumber;
                }
              }
            });
          }
          if (wa) {
            const cleanNumber = wa.replace(/\D/g, '').replace(/^0/, '62');
            const message = `Halo Admin, saya ${found.clientName}. Saya ingin mengkonfirmasi pembayaran untuk tagihan foto saya (ID: ${found.id}). Berikut saya lampirkan screenshot bukti transfernya.`;
            setStudioWaUrl(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`);
          }
        } catch (e) {
          console.warn("Failed to prefetch WA number", e);
        }

        // ── KUNCI GALERI: jika project sudah diselesaikan, langsung tampilkan halaman sukses ──
        // Klien tidak bisa kembali ke halaman pemilihan foto setelah pembayaran berhasil
        const isLocked = ['Selesai', 'File Terkirim'].includes(found.status || '') || !!found.completedAt;
        if (isLocked) {
          // Pulihkan daftar foto terpilih dari Firestore (jika tersimpan)
          if (found.selectedPhotoIds && found.selectedPhotoIds.length > 0) {
            setSelectedPhotos(new Set(found.selectedPhotoIds));
          }
          setShowSuccess(true);
          setIsLoading(false);
          return; // jangan muat foto galeri
        }

      if (found.gdriveFolderId) {
        try {
          const res = await fetch(`/api/drive/list-photos?folderId=${found.gdriveFolderId}`);
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

  const extraPhotoItem = priceList.find(item => item.id === "extra_photo");
  const activeExtraPhotoPrice = extraPhotoItem ? extraPhotoItem.price : 50000;
  
  const extraPhotosCount = project ? Math.max(0, selectedPhotos.size - project.maxPhotos) : 0;
  const extraPhotosCost = extraPhotosCount * activeExtraPhotoPrice;

  const addonsCost = Object.entries(selectedAddons).reduce((acc, [id, qty]) => {
    const item = priceList.find(p => p.id === id);
    if (item && item.scheme !== 'sudah bayar') return acc + (item.price * qty);
    return acc;
  }, 0);

  const totalExtraCost = extraPhotosCost + addonsCost;
  const basePackagePrice = project?.packagePrice || 0;
  const dpAmount = project?.dpAmount || 0;
  
  // Tagihan tidak boleh minus
  const grandTotal = Math.max(0, basePackagePrice + totalExtraCost - dpAmount);

  const handleConfirm = async () => {
    if (!project) return;
    
    if (grandTotal === 0) {
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
    
    // Simpan pilihan foto ke Firestore lebih awal agar tidak hilang
    // jika webhook merubah status ke 'Selesai' sebelum klien mengeklik apapun.
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        selectedPhotoIds: Array.from(selectedPhotos),
        extraRevenue: totalExtraCost,
        selectedAddons: selectedAddons,
      });
    } catch(e) {
      console.error('Gagal menyimpan foto terpilih sementara:', e);
    }
    
    try {
      const res = await fetch('/api/payment/create-qris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: newOrderId,
          grossAmount: grandTotal,
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

  const handleWhatsAppConfirmAsync = () => {
    if (!project) return;
    
    if (!studioWaUrl) {
      alert("Nomor WhatsApp admin belum dikonfigurasi di sistem. Silakan hubungi fotografer Anda secara manual.");
      return;
    }
    
    // Update local state IMMEDIATELY for snappy UI feedback
    setProject({
      ...project,
      paymentProofStatus: 'pending'
    });

    // Fire and forget update ke Firestore, tidak perlu di-await karena browser
    // akan membuka tab baru dan script di tab ini akan terus berjalan di background.
    updateDoc(doc(db, 'projects', project.id), {
      paymentProofStatus: 'pending',
      extraRevenue: totalExtraCost,
      selectedAddons: selectedAddons,
      selectedPhotoIds: Array.from(selectedPhotos)
    }).catch(err => {
      console.error("Gagal update status manual:", err);
    });
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

  // Real-time Firestore listener for instant webhook confirmation
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Initialize
  useEffect(() => {
    if (!project || !showInvoice || paymentStatus !== 'pending') return;
    
    const unsubscribe = onSnapshot(doc(db, "projects", project.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'Selesai') {
          setPaymentStatus('settlement');
          setShowInvoice(false);
          setShowSuccess(true);
        }
      }
    });
    
    return () => unsubscribe();
  }, [project, showInvoice, paymentStatus]);

  const handlePaymentSuccess = () => {
    updateProjectStatusToSelesai();
    setShowInvoice(false);
    setShowSuccess(true);
  };

  const updateAddonQty = (id: string, delta: number) => {
    setSelectedAddons(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      const newAddons = { ...prev };
      if (next === 0) {
        delete newAddons[id];
      } else {
        newAddons[id] = next;
      }
      return newAddons;
    });
  };

  const updateProjectStatusToSelesai = async () => {
    if (!project) return;
    const selectedIds = Array.from(selectedPhotos);
    try {
      await updateDoc(doc(db, 'projects', project.id), {
        status: 'Selesai',
        extraRevenue: totalExtraCost,
        selectedAddons: selectedAddons,
        // Simpan ID foto terpilih agar bisa dipulihkan setelah refresh
        selectedPhotoIds: selectedIds,
        completedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
    }

    // Update fallback localStorage
    const savedProjects = JSON.parse(localStorage.getItem('zeey_projects') || '[]');
    const updatedProjects = savedProjects.map((p: Project) => {
      if (p.id === project.id) {
        return {
          ...p,
          status: 'Selesai',
          extraRevenue: totalExtraCost,
          selectedAddons: selectedAddons,
          selectedPhotoIds: selectedIds,
          completedAt: new Date().toISOString(),
        };
      }
      return p;
    });
    localStorage.setItem('zeey_projects', JSON.stringify(updatedProjects));
  };

  const handleEditorRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setIsSubmittingEditor(true);
    try {
      await addDoc(collection(db, "editor_requests"), {
        projectId: project.id,
        clientName: project.clientName,
        notes: editorNotes,
        status: "Pending",
        createdAt: new Date().toISOString()
      });
      // Automatically add Jasa Editor to selected addons for billing
      updateAddonQty("editor_request", 1);
      
      setEditorRequestSuccess(true);
      setTimeout(() => {
        setShowEditorModal(false);
        setEditorRequestSuccess(false);
        setEditorNotes("");
      }, 3000);
    } catch (err) {
      alert("Gagal mengirim request editor.");
    } finally {
      setIsSubmittingEditor(false);
    }
  };

  const downloadTextList = () => {
    if (!project) return;

    // Jika photos sudah dimuat (mode galeri aktif), filter dari state
    // Jika photos kosong (halaman sukses setelah refresh), gunakan selectedPhotoIds dari Firestore
    if (photos.length > 0) {
      const selectedPhotoArray = photos.filter(p => selectedPhotos.has(p.id));
      const names = selectedPhotoArray.map(p => p.name).join(", ");
      const blob = new Blob([names], { type: "text/plain;charset=utf-8" });
      saveAs(blob, `Daftar_File_Terpilih_${project.clientName.replace(/\s+/g, '_')}.txt`);
    } else {
      // Fallback: hanya tampilkan ID foto karena nama tidak tersedia tanpa memuat ulang
      const ids = project.selectedPhotoIds || Array.from(selectedPhotos);
      const text = `Daftar ID Foto Terpilih (${ids.length} foto):\n` + ids.join("\n");
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      saveAs(blob, `Daftar_File_Terpilih_${project.clientName.replace(/\s+/g, '_')}.txt`);
    }
  };

  const downloadSelectedZip = async () => {
    if (!project) return;
    setIsZipping(true);
    setZipProgress(0);
    const zip = new JSZip();

    // ── FIX: Ketika halaman sukses dibuka langsung (setelah refresh), photos[] kosong ──
    // Karena galeri tidak dimuat ulang di mode locked. Gunakan selectedPhotoIds dari Firestore
    // dan fetch foto langsung menggunakan Drive image API.
    let photosToDownload: { id: string; name: string }[];

    if (photos.length > 0) {
      // Mode normal: foto sudah ada di state (baru saja konfirmasi di sesi ini)
      photosToDownload = photos.filter(p => selectedPhotos.has(p.id));
    } else {
      // Mode sukses setelah refresh: ambil ID dari Firestore, nama akan diambil dari header response
      const ids = project.selectedPhotoIds || Array.from(selectedPhotos);
      photosToDownload = ids.map((id, i) => ({ id, name: `foto_${i + 1}.jpg` }));

      // Coba ambil nama file yang benar dari Drive API
      if (project.gdriveFolderId) {
        try {
          const res = await fetch(`/api/drive/list-photos?folderId=${project.gdriveFolderId}`);
          const data = await res.json();
          if (res.ok && data.success && data.photos) {
            const photoMap = new Map<string, string>(data.photos.map((p: { id: string; name: string }) => [p.id, p.name]));
            photosToDownload = ids.map((id, i) => ({
              id,
              name: photoMap.get(id) || `foto_${i + 1}.jpg`,
            }));
          }
        } catch (e) {
          console.warn('Gagal mengambil nama foto dari Drive, menggunakan nama default.');
        }
      }
    }
    
    try {
      let count = 0;
      // Fetch in parallel batches of 5 to avoid browser network queue congestion
      const batchSize = 5;
      for (let i = 0; i < photosToDownload.length; i += batchSize) {
        const batch = photosToDownload.slice(i, i + batchSize);
        await Promise.all(batch.map(async (photo) => {
          try {
            const res = await fetch(`/api/drive/image?id=${photo.id}`);
            if (res.ok) {
              const blob = await res.blob();
              zip.file(photo.name, blob);
            }
          } catch (e) {
            console.error("Failed to fetch", photo.name);
          }
          count++;
          setZipProgress(Math.round((count / photosToDownload.length) * 100));
        }));
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `Foto_Terpilih_${project.clientName.replace(/\s+/g, '_')}.zip`);
    } catch (e) {
      alert("Gagal membuat file ZIP.");
    } finally {
      setIsZipping(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Memuat galeri...</div>;
  if (!project) return <div className="min-h-screen flex items-center justify-center">Project tidak ditemukan.</div>;


  if (showSuccess) {
    // Hitung jumlah foto: dari selectedPhotos state, atau dari data Firestore (setelah refresh)
    const confirmedPhotoCount =
      selectedPhotos.size > 0
        ? selectedPhotos.size
        : (project.selectedPhotoIds?.length ?? 0);

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h1 className="text-4xl mb-4">Terima Kasih, {project.clientName}!</h1>
        <p className="text-foreground/70 font-sans max-w-md mx-auto mb-8">
          Pembayaran berhasil dan pilihan foto Anda ({confirmedPhotoCount} foto) telah dikonfirmasi. Anda dapat mengunduh foto beresolusi tinggi sekarang.
        </p>

        <div className="flex flex-col gap-4 mb-6">
          <button
            onClick={downloadSelectedZip}
            disabled={isZipping}
            className="bg-primary text-white px-8 py-4 rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-lg font-sans flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            {isZipping ? `Membuat ZIP... ${zipProgress}%` : `Unduh Foto Terpilih (.zip)`}
          </button>
          
          <button
            onClick={downloadTextList}
            className="bg-surface-alt text-foreground px-8 py-4 rounded-xl font-medium hover:bg-surface-alt/80 border border-border transition-colors font-sans flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Unduh Daftar Nama File (.txt)
          </button>
        </div>
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

      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface/80 backdrop-blur-md border-b border-white/10 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-serif text-foreground tracking-wide">{project.clientName}</h1>
            <p className="text-[10px] md:text-xs text-foreground/60 font-sans uppercase tracking-widest mt-1">Pemilihan Foto Eksklusif</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowPriceList(true)}
              className="w-10 h-10 md:w-auto md:px-4 flex items-center justify-center gap-2 rounded-full bg-surface-alt/50 border border-white/20 text-foreground/80 hover:bg-surface-alt transition-all cursor-pointer backdrop-blur-sm"
              title="Daftar Harga"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
              <span className="hidden md:inline text-sm font-medium">Harga Tambahan</span>
            </button>
            <button 
              onClick={() => setShowEditorModal(true)}
              className="w-10 h-10 md:w-auto md:px-4 flex items-center justify-center gap-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 hover:bg-purple-500/20 transition-all cursor-pointer backdrop-blur-sm"
              title="Request Editor"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              <span className="hidden md:inline text-sm font-medium">Request Editor</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Action Bar (Bottom Pill) */}
      <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[600px] z-50">
        <div className="bg-surface/90 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full p-2 flex items-center justify-between transition-all duration-300">
          <div className="flex items-center pl-4 gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-foreground/50 uppercase tracking-widest font-medium">Terpilih</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-serif leading-none ${selectedPhotos.size > project.maxPhotos ? "text-accent" : "text-foreground"}`}>
                  {selectedPhotos.size}
                </span>
                <span className="text-sm text-foreground/40">/ {project.maxPhotos}</span>
              </div>
            </div>
            {grandTotal > 0 && (
              <div className="h-8 w-[1px] bg-border/50 mx-2"></div>
            )}
            {grandTotal > 0 && (
              <div className="flex flex-col animate-in fade-in slide-in-from-left-2">
                <span className="text-[10px] text-accent/70 uppercase tracking-widest font-medium">Total Tagihan</span>
                <span className="text-sm font-bold text-accent leading-none">Rp {(grandTotal/1000).toLocaleString('id-ID')}k</span>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleConfirm}
            disabled={selectedPhotos.size === 0 && Object.keys(selectedAddons).length === 0}
            className="bg-accent text-white px-6 md:px-8 py-3.5 rounded-full font-medium hover:bg-accent-dark transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-[0_4px_14px_rgba(var(--accent-rgb),0.4)] hover:shadow-[0_6px_20px_rgba(var(--accent-rgb),0.6)] hover:-translate-y-0.5 active:translate-y-0"
          >
            Konfirmasi
          </button>
        </div>
      </div>

      {/* Top spacing to compensate for fixed header */}
      <div className="h-24 md:h-28"></div>

      {/* Warning Banner if Over Limit */}
      {selectedPhotos.size > project.maxPhotos && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="bg-accent/10 border border-accent/20 text-accent py-3 px-6 rounded-2xl text-center text-sm font-sans flex flex-col md:flex-row items-center justify-center gap-2 animate-in slide-in-from-top-4 fade-in duration-500 shadow-sm">
            <span>Anda memilih <strong>{extraPhotosCount} foto ekstra</strong> dari batas paket.</span>
            <span className="hidden md:inline">•</span>
            <span className="font-bold">Tambahan: Rp {totalExtraCost.toLocaleString('id-ID')}</span>
          </div>
        </div>
      )}

      {/* Tip for users */}
      <div className="max-w-7xl mx-auto px-4 mb-8 flex justify-center">
        <p className="text-xs text-foreground/50 font-sans italic bg-surface-alt/50 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm shadow-sm inline-block">
          💡 Ketuk 1x untuk memilih. Tekan lama pada foto untuk melihat ukuran penuh.
        </p>
      </div>

      {/* Gallery Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center mb-8">
            {errorMsg}
          </div>
        )}

        {!isLoading && photos.length === 0 && !errorMsg && (
          <div className="text-center py-24 bg-surface/50 backdrop-blur-sm border border-dashed border-border rounded-3xl animate-in fade-in duration-700">
            <svg className="w-16 h-16 text-foreground/20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <h3 className="text-xl font-serif text-foreground mb-2">Belum ada foto</h3>
            <p className="text-foreground/60 max-w-md mx-auto text-sm">
              Fotografer belum mengunggah foto ke galeri Anda.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 pb-32">
          {photos.map((photo, index) => {
            const isSelected = selectedPhotos.has(photo.id);
            // Dynamic animation delay for staggered entrance
            const animationDelay = `${(index % 12) * 50}ms`;
            
            return (
              <div 
                key={photo.id} 
                onPointerDown={() => startPress(photo)}
                onPointerUp={() => endPress(photo.id)}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => { e.preventDefault(); cancelPress(); }}
                className={`relative aspect-[3/4] cursor-pointer group rounded-2xl overflow-hidden transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-8 ${isSelected ? 'scale-[0.93] shadow-lg shadow-accent/20' : 'hover:scale-[0.98] hover:shadow-md bg-surface-alt'}`}
                style={{ animationDelay, animationFillMode: 'both' }}
              >
                {/* Elegant border for selected state */}
                <div className={`absolute inset-0 z-20 pointer-events-none rounded-2xl border-4 transition-colors duration-300 ${isSelected ? 'border-accent' : 'border-transparent'}`}></div>
                
                {/* Watermark Anti-Screenshot (Grid) */}
                <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden opacity-[0.25] mix-blend-overlay flex items-center justify-center">
                  <div className="transform -rotate-45 font-black text-white text-3xl sm:text-4xl whitespace-nowrap tracking-widest uppercase drop-shadow-lg select-none">
                    Zeey Studio
                  </div>
                </div>

                {photo.thumbnailUrl ? (
                  <SecureImage src={photo.thumbnailUrl} alt={photo.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-border/30 text-foreground/40 text-sm p-4 text-center">
                    {photo.name}
                  </div>
                )}
                
                {/* Selection Indicator */}
                <div className={`absolute top-3 right-3 md:top-4 md:right-4 w-7 h-7 md:w-8 md:h-8 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-300 z-30 ${isSelected ? 'bg-accent border-accent text-white scale-110 shadow-[0_2px_10px_rgba(var(--accent-rgb),0.5)]' : 'border-white/80 bg-black/30 group-hover:bg-black/50 backdrop-blur-sm'}`}>
                  <svg className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-300 ${isSelected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                  </svg>
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
            <SecureImage src={viewingPhoto.fullUrl} alt={viewingPhoto.name} isFullscreen={true} />
            
            {/* Watermark Anti-Screenshot (Modal Fullscreen) */}
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden opacity-[0.15] mix-blend-overlay flex items-center justify-center">
               <div className="transform -rotate-45 font-black text-white text-6xl sm:text-7xl md:text-9xl whitespace-nowrap tracking-widest uppercase drop-shadow-2xl select-none">
                 Zeey Studio
               </div>
            </div>
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
                {basePackagePrice > 0 && (
                  <div className="flex justify-between text-sm pb-4 border-b border-border">
                    <span className="text-foreground/70">Paket: {project.packageName || 'Kustom'}</span>
                    <span className="font-medium">Rp {basePackagePrice.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {extraPhotosCount > 0 && (
                  <div className="flex justify-between text-sm pb-4 border-b border-border">
                    <span className="text-foreground/70">Foto Tambahan ({extraPhotosCount} x Rp {activeExtraPhotoPrice.toLocaleString('id-ID')})</span>
                    <span className="font-medium">Rp {extraPhotosCost.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {Object.entries(selectedAddons).map(([id, qty]) => {
                  const item = priceList.find(p => p.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="flex justify-between text-sm pb-4 border-b border-border">
                      <span className="text-foreground/70">
                        {item.name} ({qty} x {item.scheme === 'sudah bayar' ? 'Sudah Dibayar' : `Rp ${item.price.toLocaleString('id-ID')}`})
                      </span>
                      <span className={`font-medium ${item.scheme === 'sudah bayar' ? 'text-emerald-600' : ''}`}>
                        {item.scheme === 'sudah bayar' ? 'Rp 0' : `Rp ${(item.price * qty).toLocaleString('id-ID')}`}
                      </span>
                    </div>
                  );
                })}
                {dpAmount > 0 && (
                  <div className="flex justify-between text-sm pb-4 border-b border-border text-green-600">
                    <span>Telah Dibayar (DP / Uang Muka)</span>
                    <span className="font-medium">- Rp {dpAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl pt-2 font-serif">
                  <span>Sisa Tagihan</span>
                  <span className="text-accent">Rp {grandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* QRIS Payment Area */}
              <div className="bg-surface-alt border border-border rounded-2xl flex flex-col items-center justify-center mb-6 overflow-hidden relative min-h-[250px]">
                {project.paymentProofStatus === 'pending' ? (
                  <div className="flex flex-col items-center py-12 px-6 text-center animate-in fade-in zoom-in">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    </div>
                    <h3 className="font-serif text-xl mb-2 text-foreground">Menunggu Konfirmasi Admin</h3>
                    <p className="text-sm font-sans text-foreground/60 mb-6">
                      Pastikan Anda telah mengirimkan <strong>screenshot bukti transfer</strong> ke WhatsApp admin. Halaman ini akan berlanjut otomatis setelah admin memverifikasi.
                    </p>
                  </div>
                ) : project.paymentProofStatus === 'rejected' ? (
                  <div className="flex flex-col items-center py-12 px-6 text-center animate-in fade-in zoom-in w-full">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </div>
                    <h3 className="font-serif text-xl mb-2 text-foreground">Bukti Belum Valid</h3>
                    <p className="text-sm font-sans text-foreground/60 mb-6">
                      Admin belum menerima bukti pembayaran yang sah. Silakan hubungi admin kembali via WhatsApp.
                    </p>
                    <button 
                      onClick={handleWhatsAppConfirmAsync}
                      className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium font-sans rounded-xl text-center transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                      Hubungi Ulang Admin via WA
                    </button>
                  </div>
                ) : isUploadingProof ? (
                  <div className="flex flex-col items-center py-12 px-6">
                    <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-sans text-foreground/60">Mengarahkan ke WhatsApp...</p>
                  </div>
                ) : isPaymentLoading ? (
                  <div className="flex flex-col items-center py-12 px-6">
                    <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-sans text-foreground/60">Menyiapkan kode QRIS...</p>
                  </div>
                ) : qrisString ? (
                  <>
                    {/* QR Code */}
                    <div className="w-full flex items-center justify-center bg-white p-6">
                      <div className="bg-white p-3 rounded-2xl shadow-sm">
                        <QRCodeSVG value={qrisString} size={190} />
                      </div>
                    </div>

                    {/* Status bar di bawah QR */}
                    <div className="w-full px-5 py-4 border-t border-border flex flex-col items-center gap-3">
                      {isMockPayment ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                          <p className="text-xs font-sans text-amber-600 font-medium">Mode Simulasi (Casaku belum dikonfigurasi)</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 w-full">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <p className="text-xs font-sans text-emerald-600 font-semibold">Menunggu pembayaran masuk...</p>
                          </div>
                          
                          {studioWaUrl ? (
                            <a 
                              href={studioWaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={handleWhatsAppConfirmAsync}
                              className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium font-sans text-center transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                              Konfirmasi via WhatsApp
                            </a>
                          ) : (
                            <button 
                              onClick={handleWhatsAppConfirmAsync}
                              className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium font-sans text-center transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                              Konfirmasi via WhatsApp
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-10 px-6 text-center">
                    <p className="text-sm font-sans text-red-500">Gagal memuat kode QR. Silakan tutup dan coba lagi.</p>
                  </div>
                )}
              </div>

              {/* Auto-verification notice */}
              {qrisString && !isMockPayment && (
                <div className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 mb-5 font-sans">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    <span className="font-bold">Konfirmasi otomatis aktif.</span> Setelah pembayaran berhasil, halaman ini akan langsung diperbarui secara otomatis tanpa perlu klik tombol apapun.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowInvoice(false)}
                    className="flex-1 py-3 border border-border rounded-xl font-sans font-medium text-sm hover:bg-surface-alt transition-colors cursor-pointer text-foreground/70"
                  >
                    Tutup
                  </button>
                  {isMockPayment && (
                    <button
                      onClick={handlePaymentSuccess}
                      className="flex-1 py-3 bg-accent text-white rounded-xl font-medium text-sm hover:bg-accent-dark transition-colors font-sans shadow-md cursor-pointer"
                    >
                      ✓ Simulasi Berhasil
                    </button>
                  )}
                </div>
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
              {priceList.filter(item => item.id !== "extra_photo").length === 0 ? (
                <p className="text-center text-foreground/60 font-sans py-4">Belum ada daftar harga tambahan.</p>
              ) : (
                <div className="space-y-4">
                  {priceList.filter(item => item.id !== "extra_photo").map(item => (
                    <div key={item.id} className="flex justify-between items-center p-4 bg-background border border-border rounded-xl">
                      <div>
                        <div className="font-medium text-foreground mb-1">{item.name}</div>
                        <div className="text-xs text-foreground/60 font-sans">{item.unit}</div>
                        <div className="font-bold text-accent font-sans mt-1">
                          Rp {item.price.toLocaleString("id-ID")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateAddonQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-alt border border-border hover:bg-border transition-colors">-</button>
                        <span className="font-sans font-medium w-4 text-center">{selectedAddons[item.id] || 0}</span>
                        <button onClick={() => updateAddonQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-accent text-white hover:bg-accent-dark transition-colors">+</button>
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

      {/* Editor Request Modal */}
      {showEditorModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 md:p-8">
              <h2 className="text-2xl font-serif mb-2 text-foreground">Request Jasa Editor</h2>
              <p className="text-foreground/70 font-sans text-sm mb-6">
                Punya permintaan khusus untuk editan foto? Sampaikan ke tim editor kami di sini.
              </p>
              
              {editorRequestSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-center mb-4 flex flex-col items-center">
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="font-medium">Request Berhasil Terkirim!</span>
                  <span className="text-sm mt-1">Tim kami akan segera memproses.</span>
                </div>
              ) : (
                <form onSubmit={handleEditorRequestSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Catatan Khusus (Opsional)</label>
                    <textarea 
                      value={editorNotes}
                      onChange={(e) => setEditorNotes(e.target.value)}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all resize-none h-32"
                      placeholder="Contoh: Tolong hapus jerawat di wajah, ratakan warna kulit, dan buat lebih cerah."
                    />
                  </div>
                  
                  <div className="flex gap-4 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowEditorModal(false)}
                      className="flex-1 py-3 border border-border rounded-xl hover:bg-surface-alt transition-colors cursor-pointer font-medium"
                    >
                      Batal
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmittingEditor}
                      className="flex-1 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors cursor-pointer font-medium shadow-md disabled:opacity-70 flex justify-center items-center"
                    >
                      {isSubmittingEditor ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        "Kirim Request"
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
