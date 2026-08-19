"use client";

import { useState, useEffect, use, useRef, useCallback, memo } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { saveAs } from "file-saver";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, onSnapshot } from "firebase/firestore";

import { SubToken } from "@/components/MultiTokenModal";
import { translations, Language } from "@/lib/client-translations";
import { extractGDriveFolderId } from "@/lib/drive-utils";

declare global {
  interface Window {
    snap?: any;
  }
}

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  gdriveLinkWatermark: string;
  gdriveLinkHighRes: string;
  maxPhotos: number;
  subTokens?: SubToken[];
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
  previewUrl: string;   // Drive thumbnail s1000 — untuk fullscreen preview
  fallbackUrl?: string; // Server proxy s300 — thumbnail cepat jika CDN diblokir
  fullUrl: string;      // Server proxy full — untuk download high-res
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

// ── SecureImage: Watermark overlay tanpa MutationObserver per-foto ──
// MutationObserver dipindah ke level gallery (satu observer, bukan per foto)
// sehingga tidak membebani mobile dengan 100+ observer sekaligus.
const SecureImage = memo(({ src, fallbackSrc, alt, isFullscreen = false }: { src: string; fallbackSrc?: string; alt: string; isFullscreen?: boolean }) => {
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    setImgSrc(src);
  }, [src]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <img 
        src={imgSrc} 
        alt={alt} 
        className={`${isFullscreen ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-cover'} select-none pointer-events-none`}
        loading="lazy"
        decoding="async"
        onError={() => {
          if (fallbackSrc && imgSrc !== fallbackSrc) {
            setImgSrc(fallbackSrc);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
      {/* Repeating CSS Watermark — pure CSS, zero JS overhead */}
      <div className="absolute inset-0 z-[5] pointer-events-none flex flex-col items-center justify-center opacity-30 overflow-hidden mix-blend-overlay">
        {Array.from({ length: isFullscreen ? 12 : 4 }).map((_, i) => (
          <div key={i} className={`text-white font-bold ${isFullscreen ? 'text-4xl md:text-6xl mb-24' : 'text-2xl mb-8'} whitespace-nowrap transform -rotate-45 tracking-widest select-none drop-shadow-[0_0_8px_rgba(0,0,0,0.9)]`}>
            ZEEY STUDIO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ZEEY STUDIO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ZEEY STUDIO
          </div>
        ))}
      </div>
      {/* Invisible overlay blocking interaction */}
      <div className="absolute inset-0 z-10" onContextMenu={(e) => e.preventDefault()} />
    </div>
  );
});
SecureImage.displayName = "SecureImage";

// ── LazyImage: skeleton + native browser lazy loading + fallback ──
const LazyImage = memo(({ src, fallbackSrc, alt }: { src: string; fallbackSrc?: string; alt: string }) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setLoaded(false);
  }, [src]);

  return (
    <div className="relative w-full h-full">
      {/* Skeleton pulse selama gambar belum selesai load */}
      {!loaded && (
        <div className="absolute inset-0 bg-surface-alt animate-pulse rounded-xl" />
      )}
      <img
        src={imgSrc}
        alt={alt}
        className={`w-full h-full object-cover select-none pointer-events-none transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (fallbackSrc && imgSrc !== fallbackSrc) {
            setImgSrc(fallbackSrc);
          } else {
            setLoaded(true);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
});
LazyImage.displayName = "LazyImage";

export default function ClientGallery({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Language translation state
  const [lang, setLang] = useState<Language>('id');
  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("zeey_client_lang") as Language;
    if (savedLang === "en" || savedLang === "id") {
      setLang(savedLang);
    }
  }, []);

  const toggleLang = () => {
    const nextLang = lang === 'id' ? 'en' : 'id';
    setLang(nextLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem("zeey_client_lang", nextLang);
    }
  };
  
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
  
  // Multi-token link states
  const [activeSubToken, setActiveSubToken] = useState<SubToken | null>(null);
  const [showSubTokenSelector, setShowSubTokenSelector] = useState(false);

  // Transfer Manual & Midtrans Review states
  const [manualBankInfo, setManualBankInfo] = useState<{ bankName: string; accountNumber: string; accountName: string } | null>(null);
  const [copiedBank, setCopiedBank] = useState(false);
  const [midtransReviewNotice, setMidtransReviewNotice] = useState<string | null>(null);
  
  // Midtrans states
  const [snapToken, setSnapToken] = useState<string | null>(null);
  const [snapConfig, setSnapConfig] = useState<{ clientKey?: string; isProduction?: boolean } | null>(null);
  const [isSnapLoaded, setIsSnapLoaded] = useState(false);

  const ensureSnapScriptLoaded = useCallback((clientKey?: string, isProduction?: boolean): Promise<boolean> => {
    return new Promise((resolve) => {
      const key = clientKey || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
      const prod = typeof isProduction === 'boolean'
        ? isProduction
        : process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';

      if (!key) {
        resolve(false);
        return;
      }

      const targetUrl = prod
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js';

      const existingScript = document.querySelector('script[src*="snap.js"]') as HTMLScriptElement | null;
      if (existingScript) {
        if (existingScript.src === targetUrl && window.snap) {
          setIsSnapLoaded(true);
          resolve(true);
          return;
        }
        // Remove outdated or mismatched script tag
        existingScript.remove();
        if (window.snap) {
          delete window.snap;
        }
      }

      const script = document.createElement('script');
      script.src = targetUrl;
      script.setAttribute('data-client-key', key);
      script.onload = () => {
        setIsSnapLoaded(true);
        resolve(true);
      };
      script.onerror = () => {
        console.error("Gagal memuat script Midtrans Snap");
        resolve(false);
      };

      document.body.appendChild(script);
    });
  }, []);

  // ZIP Download state
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipStatus, setZipStatus] = useState<'idle' | 'preparing' | 'downloading'>('idle');

  // Per-foto sequential download queue (lebih andal di HP)
  const [dlQueue, setDlQueue] = useState<{ current: number; total: number } | null>(null);

  // Drive Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportLink, setExportLink] = useState<string | null>(null);

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
        let projectId = resolvedParams.id;
        if (typeof window !== "undefined") {
          const pathParts = window.location.pathname.split("/").filter(Boolean);
          const clientIdx = pathParts.indexOf("client");
          if (clientIdx !== -1 && pathParts[clientIdx + 1] && pathParts[clientIdx + 1] !== "index") {
            projectId = decodeURIComponent(pathParts[clientIdx + 1]);
          }
        }

        // ── Parallel fetch: project + pricelist + settings/profile sekaligus ──
        // Hemat 1-2 detik dibanding sequential (masing-masing ~300-500ms di mobile)
        const [docSnap, priceSnap, profileSnap, paymentSnap] = await Promise.all([
          getDoc(doc(db, "projects", projectId)),
          getDocs(collection(db, "pricelist")),
          getDoc(doc(db, "settings", "profile")),
          getDoc(doc(db, "settings", "payment")),
        ]);

        if (paymentSnap.exists()) {
          const pData = paymentSnap.data();
          if (pData.bankName || pData.accountNumber) {
            setManualBankInfo({
              bankName: pData.bankName || "",
              accountNumber: pData.accountNumber || "",
              accountName: pData.accountName || ""
            });
          }
        }

        // ── Process project ──
        let found: Project | null = null;
        if (docSnap.exists()) {
          found = { id: docSnap.id, ...docSnap.data() } as Project;
        } else {
          // Fallback to localStorage for older projects
          const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
          found = savedProjects.find((p: Project) => p.id === projectId) || null;
        }

        // ── Process pricelist ──
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
        const defaultSystemPrices: PriceItem[] = [
          { id: "extra_photo", name: "Foto Tambahan", price: 50000, unit: "per foto", isSystem: true },
          { id: "editor_request", name: "Jasa Editor (Retouch)", price: 100000, unit: "per request", isSystem: true }
        ];
        defaultSystemPrices.forEach(def => {
          if (!pricesMap.has(def.id)) pricesMap.set(def.id, def);
        });
        const prices = Array.from(pricesMap.values());
        prices.sort((a, b) => (a.isSystem === b.isSystem ? 0 : a.isSystem ? -1 : 1));
        setPriceList(prices);

        if (!found) {
          setIsLoading(false);
          return;
        }
        setProject(found);

        // ── Process Sub-tokens ──
        let matchedSub: SubToken | undefined;
        if (typeof window !== "undefined") {
          const urlToken = new URLSearchParams(window.location.search).get("token");
          if (found.subTokens && found.subTokens.length > 0) {
            if (urlToken) {
              matchedSub = found.subTokens.find(st => st.id === urlToken);
            }
            if (matchedSub) {
              setActiveSubToken(matchedSub);
              if (matchedSub.selectedPhotoIds && matchedSub.selectedPhotoIds.length > 0) {
                setSelectedPhotos(new Set(matchedSub.selectedPhotoIds));
              }
            } else {
              setShowSubTokenSelector(true);
            }
          } else if (found.selectedPhotoIds && found.selectedPhotoIds.length > 0) {
            setSelectedPhotos(new Set(found.selectedPhotoIds));
          }
        }

        // ── Process WA number (profile sudah di-fetch paralel) ──
        try {
          let wa = "";
          if (profileSnap.exists() && profileSnap.data().waNumber) {
            wa = profileSnap.data().waNumber;
          }
          // Fallback: ambil dari koleksi admins hanya jika profile belum ada WA
          if (!wa) {
            const adminsSnap = await getDocs(collection(db, "admins"));
            let anyAdminWa = "";
            adminsSnap.forEach(d => {
              const adminData = d.data();
              if (!adminData.waNumber) return;
              if (adminData.username === found.createdBy || adminData.username === found.assignedAdmin) {
                wa = adminData.waNumber;
              }
              if (!anyAdminWa) anyAdminWa = adminData.waNumber;
            });
            if (!wa) wa = anyAdminWa;
          }
          if (wa) {
            const cleanNumber = wa.replace(/\D/g, '').replace(/^0/, '62');
            const message = `Halo Admin, saya ${found.clientName}. Saya ingin mengkonfirmasi pembayaran untuk tagihan foto saya (ID: ${found.id}). Berikut saya lampirkan screenshot bukti transfernya.`;
            setStudioWaUrl(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`);
          }
        } catch (e) {
          console.warn("Failed to prefetch WA number", e);
        }

        // ── KUNCI GALERI: kunci galeri jika status proyek/subToken sudah 'Selesai' atau 'File Terkirim' ──
        const isSubDone = matchedSub ? matchedSub.status === 'Selesai' : false;
        const isProjectDone = found.status === 'Selesai' || found.status === 'File Terkirim';
        const isLocked = isSubDone || isProjectDone;
        if (isLocked) {
          if (matchedSub && matchedSub.selectedPhotoIds && matchedSub.selectedPhotoIds.length > 0) {
            setSelectedPhotos(new Set(matchedSub.selectedPhotoIds));
          } else if (found.selectedPhotoIds && found.selectedPhotoIds.length > 0) {
            setSelectedPhotos(new Set(found.selectedPhotoIds));
          }
          setShowSuccess(true);
          setIsLoading(false);
          return;
        }

        // ── Load photos dari Drive ──
        const targetFolderId = 
          extractGDriveFolderId(found.gdriveFolderId) ||
          extractGDriveFolderId(found.gdriveLinkHighRes) ||
          extractGDriveFolderId(found.gdriveLinkWatermark);

        if (targetFolderId) {
          try {
            const res = await fetch(`/api/drive/list-photos?folderId=${encodeURIComponent(targetFolderId)}`);
            const data = await res.json();
            if (res.ok && data.success) {
              setPhotos(data.photos || []);
              setErrorMsg("");
            } else {
              setErrorMsg(data.error || "Gagal memuat foto dari Google Drive");
            }
          } catch (err) {
            setErrorMsg("Terjadi kesalahan saat memuat foto");
          }
        } else {
          setPhotos([]);
          setErrorMsg("");
        }
        setIsLoading(false);
      } catch (e) {
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

  // Load Midtrans Snap Script
  useEffect(() => {
    const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    
    // Only load if client key is configured
    if (!clientKey) return;

    const scriptUrl = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';

    // Prevent duplicate script tags
    if (document.querySelector(`script[src="${scriptUrl}"]`)) {
      setIsSnapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.setAttribute('data-client-key', clientKey);
    script.onload = () => setIsSnapLoaded(true);
    script.onerror = () => console.error("Gagal memuat script Midtrans Snap");
    
    document.body.appendChild(script);

    return () => {
       // Optional: remove script on cleanup, though usually keeping it is fine for SPA
    };
  }, []);

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

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const togglePhoto = (id: string) => {
    const isSubDone = activeSubToken ? activeSubToken.status === 'Selesai' : false;
    const isProjectDone = project ? (project.status === 'Selesai' || project.status === 'File Terkirim') : false;
    if (isSubDone || isProjectDone) return;

    const newSet = new Set(selectedPhotos);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPhotos(newSet);
  };

  const activeMaxPhotos = activeSubToken ? activeSubToken.maxPhotos : (project ? project.maxPhotos : 0);

  const extraPhotoItem = priceList.find(item => item.id === "extra_photo");
  const activeExtraPhotoPrice = extraPhotoItem ? extraPhotoItem.price : 50000;
  
  const extraPhotosCount = project ? Math.max(0, selectedPhotos.size - activeMaxPhotos) : 0;
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
      return;
    }

    if (snapToken) {
      triggerSnapPayment(snapToken);
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
      
      if (data.success) {
        setMidtransReviewNotice(null);
        if (data.mode === 'midtrans-snap' && data.snapToken) {
           setSnapToken(data.snapToken);
           setSnapConfig({ clientKey: data.clientKey, isProduction: data.isProduction });
           const loaded = await ensureSnapScriptLoaded(data.clientKey, data.isProduction);
           if (loaded) {
              setShowInvoice(false);
              triggerSnapPayment(data.snapToken);
           } else {
              alert(t.alertSnapLoadFailed);
           }
        } else if (data.qrString) {
           setQrisString(data.qrString);
           setIsMockPayment(data.isMock);
        }
      } else {
        if (data.isMidtransError) {
          setMidtransReviewNotice("Midtrans sedang dalam proses peninjauan (Review Bisnis). Silakan gunakan Transfer Manual di bawah untuk menyelesaikan pembayaran.");
        } else {
          alert(t.alertPaymentLoadFailed(data.error || "Terjadi kesalahan"));
        }
      }
    } catch (err) {
      console.error("Gagal menghubungi server pembayaran:", err);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const triggerSnapPayment = async (token: string) => {
    const loaded = await ensureSnapScriptLoaded(snapConfig?.clientKey, snapConfig?.isProduction);
    if (!loaded || !window.snap) {
       alert(t.alertSnapNotReady);
       return;
    }
    setShowInvoice(false);
    window.snap.pay(token, {
      onSuccess: function (result: any) {
        console.log('Payment success:', result);
        setPaymentStatus('settlement');
        handlePaymentSuccess();
      },
      onPending: function (result: any) {
        console.log('Payment pending:', result);
        if (result && (result.transaction_status === 'settlement' || result.transaction_status === 'capture' || result.status_code === '200')) {
          setPaymentStatus('settlement');
          handlePaymentSuccess();
        }
      },
      onError: function (result: any) {
        console.error('Payment error:', result);
        alert(t.alertPaymentFailed);
        setPaymentStatus(null);
      },
      onClose: async function () {
        console.log('Payment popup closed');
        if (orderId) {
          try {
            const res = await fetch(`/api/payment/status?orderId=${orderId}&isMock=${isMockPayment}`);
            const data = await res.json();
            if (data.success && (data.transaction_status === 'settlement' || data.transaction_status === 'capture' || data.transaction_status === 'PAID')) {
              setPaymentStatus('settlement');
              handlePaymentSuccess();
            }
          } catch (e) {
            console.error('Error checking status on close:', e);
          }
        }
      }
    });
  };

  const handleWhatsAppConfirmAsync = () => {
    if (!project) return;
    
    if (!studioWaUrl) {
      alert(t.alertNoWaNumber);
      return;
    }
    
    // Update local state IMMEDIATELY for snappy UI feedback
    setProject({
      ...project,
      paymentProofStatus: 'pending'
    });

    updateDoc(doc(db, 'projects', project.id), {
      paymentProofStatus: 'pending',
      extraRevenue: totalExtraCost,
      selectedAddons: selectedAddons,
      selectedPhotoIds: Array.from(selectedPhotos)
    }).catch(err => {
      console.error("Gagal update status manual:", err);
    });
  };

  // Poll Payment Status (only if valid Midtrans Snap token exists)
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (paymentStatus === 'pending' && orderId && snapToken && !midtransReviewNotice) {
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
      }, 3000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [showInvoice, paymentStatus, orderId, isMockPayment, snapToken, midtransReviewNotice]);

  // Real-time Firestore listener for instant webhook confirmation
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    if (!project) return;
    
    const unsubscribe = onSnapshot(doc(db, "projects", project.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'File Terkirim' || data.status === 'Selesai') {
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
      if (project.subTokens && project.subTokens.length > 0 && activeSubToken) {
        const updatedSubTokens = project.subTokens.map(st => {
          if (st.id === activeSubToken.id) {
            return {
              ...st,
              selectedPhotoIds: selectedIds,
              status: 'Selesai' as const,
              completedAt: new Date().toISOString()
            };
          }
          return st;
        });

        const combinedSelected = new Set<string>();
        updatedSubTokens.forEach(st => {
          (st.selectedPhotoIds || []).forEach(id => combinedSelected.add(id));
        });

        const isAllSubTokensDone = updatedSubTokens.every(
          st => st.status === 'Selesai' || (st.selectedPhotoIds && st.selectedPhotoIds.length >= st.maxPhotos)
        );

        const updateData: any = {
          subTokens: updatedSubTokens,
          selectedPhotoIds: Array.from(combinedSelected),
          extraRevenue: totalExtraCost,
          selectedAddons: selectedAddons,
        };

        if (isAllSubTokensDone) {
          updateData.status = 'Selesai';
          updateData.completedAt = new Date().toISOString();
        }

        await updateDoc(doc(db, 'projects', project.id), updateData);
        setProject({ ...project, ...updateData });
        setActiveSubToken({ ...activeSubToken, selectedPhotoIds: selectedIds, status: 'Selesai' });
      } else {
        await updateDoc(doc(db, 'projects', project.id), {
          status: 'Selesai',
          extraRevenue: totalExtraCost,
          selectedAddons: selectedAddons,
          selectedPhotoIds: selectedIds,
          completedAt: new Date().toISOString(),
        });
      }
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

  // ── DOWNLOAD HELPERS ──
  // Selalu ambil selectedPhotoIds terbaru dari Firestore sebagai single source of truth.
  // Ini mencegah download foto yang salah akibat state tidak sinkron, race condition,
  // atau klien membuka halaman sukses setelah refresh (photos[] kosong).
  const getVerifiedPhotosToDownload = useCallback(async (): Promise<{ id: string; name: string }[] | null> => {
    if (!project) return null;

    // 1. Ambil selectedPhotoIds terbaru langsung dari Firestore
    let confirmedIds: string[] = [];
    try {
      const docSnap = await getDoc(doc(db, 'projects', project.id));
      if (docSnap.exists()) {
        confirmedIds = docSnap.data().selectedPhotoIds || [];
      }
    } catch (e) {
      console.error('Gagal fetch selectedPhotoIds dari Firestore:', e);
      // Fallback ke project state jika Firestore error
      confirmedIds = project.selectedPhotoIds || Array.from(selectedPhotos);
    }

    if (confirmedIds.length === 0) {
      alert(t.alertNoPhotosToDownload);
      return null;
    }

    // 2. Ambil daftar foto yang tersedia di folder Drive klien
    //    lalu validasi silang: hanya foto yang ADA di folder klien DAN ada di selectedPhotoIds
    //    yang boleh didownload — mencegah download foto sembarang.
    let photosToDownload: { id: string; name: string }[] = confirmedIds.map((id, i) => ({
      id,
      name: `foto_${i + 1}.jpg`,
    }));

    const downloadFolderId = 
      extractGDriveFolderId(project.gdriveFolderId) ||
      extractGDriveFolderId(project.gdriveLinkHighRes) ||
      extractGDriveFolderId(project.gdriveLinkWatermark);

    if (downloadFolderId) {
      try {
        const res = await fetch(`/api/drive/list-photos?folderId=${encodeURIComponent(downloadFolderId)}`);
        const data = await res.json();
        if (res.ok && data.success && data.photos) {
          // Buat set ID foto yang benar-benar ada di folder Drive klien
          const folderPhotoMap = new Map<string, string>(
            data.photos.map((p: { id: string; name: string }) => [p.id, p.name])
          );
          // Filter: hanya ID yang dikonfirmasi Firestore DAN ada di folder Drive
          const verified = confirmedIds.filter(id => folderPhotoMap.has(id));
          if (verified.length === 0) {
            console.warn('Tidak ada foto pilihan yang cocok dengan folder Drive klien.');
            // Tetap gunakan confirmedIds tanpa nama — lebih aman daripada gagal total
          } else {
            photosToDownload = verified.map((id, i) => ({
              id,
              name: folderPhotoMap.get(id) || `foto_${i + 1}.jpg`,
            }));
          }
        }
      } catch (e) {
        console.warn('Gagal validasi folder Drive, lanjut dengan nama default.');
      }
    }

    return photosToDownload;
  }, [project, selectedPhotos]);

  const downloadTextList = async () => {
    if (!project) return;
    const photosToDownload = await getVerifiedPhotosToDownload();
    if (!photosToDownload) return;

    const names = photosToDownload.map(p => p.name).join(", ");
    const blob = new Blob([names], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `Daftar_File_Terpilih_${project.clientName.replace(/\s+/g, '_')}.txt`);
  };

  const downloadSelectedZip = async () => {
    if (!project) return;
    setIsZipping(true);
    setZipStatus('preparing');
    setZipProgress(0);

    try {
      // Dapatkan daftar foto terverifikasi (Firestore → validasi Drive)
      const photosToDownload = await getVerifiedPhotosToDownload();
      if (!photosToDownload || photosToDownload.length === 0) {
        setIsZipping(false);
        setZipStatus('idle');
        return;
      }

      // ── SERVER-SIDE ZIP STREAMING ──
      // Kita POST daftar foto ke server, server membangun ZIP dan langsung
      // stream hasilnya ke browser. Browser langsung menampilkan download di
      // history-nya tanpa harus menunggu semua foto selesai diunduh di sisi klien.
      setZipStatus('downloading');

      const res = await fetch('/api/drive/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: photosToDownload,
          clientName: project.clientName,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }

      // Stream the response blob and trigger browser save dialog
      const blob = await res.blob();
      saveAs(blob, `Foto_${project.clientName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);
    } catch (e: any) {
      console.error('Download ZIP gagal:', e);
      alert(t.alertZipFailed(e.message || 'Coba lagi.'));
    } finally {
      setIsZipping(false);
      setZipStatus('idle');
    }
  };

  /**
   * Unduh satu foto langsung ke browser download history.
   * Menggunakan <a download> trick agar browser langsung mulai download
   * tanpa perlu menunggu proses apapun di sisi klien.
   */
  const downloadSinglePhoto = (photo: { id: string; name: string }) => {
    const url = `/api/drive/download?id=${photo.id}&name=${encodeURIComponent(photo.name)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = photo.name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ── Fungsi download foto satu per satu (antrian) — lebih andal di HP ──
  // Setiap foto trigger native browser download secara berurutan dengan jeda 1.5 detik.
  // Klien bisa lihat progress di browser download manager mereka.
  const downloadPhotosSequentially = useCallback(async () => {
    if (!project || dlQueue) return;
    const photosToDownload = await getVerifiedPhotosToDownload();
    if (!photosToDownload || photosToDownload.length === 0) return;

    for (let i = 0; i < photosToDownload.length; i++) {
      setDlQueue({ current: i + 1, total: photosToDownload.length });
      const photo = photosToDownload[i];
      const url = `/api/drive/download?id=${photo.id}&name=${encodeURIComponent(photo.name)}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Jeda antar download agar browser tidak overwhelmed
      if (i < photosToDownload.length - 1) {
        await new Promise(res => setTimeout(res, 1500));
      }
    }
    setDlQueue(null);
  }, [project, dlQueue, getVerifiedPhotosToDownload]);

  // ── Fungsi export ke folder Google Drive baru ──
  const exportToDrive = async () => {
    if (!project) return;
    setIsExporting(true);
    
    try {
      const photosToDownload = await getVerifiedPhotosToDownload();
      if (!photosToDownload || photosToDownload.length === 0) {
        setIsExporting(false);
        return;
      }
      
      const res = await fetch('/api/drive/export-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          clientName: project.clientName,
          photoIds: photosToDownload.map(p => p.id),
          sourceFolderId: 
            extractGDriveFolderId(project.gdriveFolderId) ||
            extractGDriveFolderId(project.gdriveLinkHighRes) ||
            extractGDriveFolderId(project.gdriveLinkWatermark)
        })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Terjadi kesalahan pada server');
      }
      
      setExportLink(data.folderUrl);
    } catch (err: any) {
      console.error('Export gagal:', err);
      alert(t.alertExportFailed(err.message));
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <div className="h-24" />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-surface-alt animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
  if (!project) return <div className="min-h-screen flex items-center justify-center font-sans">{t.notFound}</div>;


  if (showSuccess) {
    const confirmedPhotoCount =
      selectedPhotos.size > 0
        ? selectedPhotos.size
        : (project.selectedPhotoIds?.length ?? 0);

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-4xl mb-4">{t.thankYou(project.clientName)}</h1>
        <p className="text-foreground/70 font-sans max-w-md mx-auto mb-8">
          {t.successDesc(confirmedPhotoCount)}
        </p>

        <div className="flex flex-col gap-3 mb-6 w-full max-w-sm">

          {/* Pesan Sabar Saat Proses */}
          {isExporting && (
            <div className="bg-blue-50/80 border border-blue-200 text-blue-800 text-xs px-4 py-3 rounded-xl mb-2 text-center animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm backdrop-blur-sm">
              <p>{t.exportingNotice}</p>
              <p className="font-semibold italic mt-1">{t.exportingQuote}</p>
            </div>
          )}

          {/* JIKA EXPORT DRIVE SELESAI, TAMPILKAN LINKNYA */}
          {exportLink ? (
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-left animate-in fade-in slide-in-from-bottom-4 mb-2">
              <p className="text-green-800 text-sm font-semibold mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t.driveCreatedTitle}
              </p>
              <p className="text-green-700/80 text-xs mb-4">
                {t.driveCreatedDesc}
              </p>
              <a 
                href={exportLink} 
                target="_blank" 
                rel="noreferrer"
                className="block w-full bg-green-600 text-white text-center py-3 rounded-lg font-medium text-sm shadow-sm hover:bg-green-700 transition-colors touch-manipulation"
              >
                {t.openDriveFolder}
              </a>
            </div>
          ) : (
            <>
              {/* Simpan ke Google Drive */}
              <button
                onClick={exportToDrive}
                disabled={isExporting}
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg font-sans flex items-center justify-center gap-2 text-base disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation relative overflow-hidden group"
              >
                {isExporting ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    {t.preparingDrive}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.71 3.5L1.15 15l3.43 6 6.55-11.5M9.73 3.5h13.12l-3.43 6H6.3M13.44 10L6.89 21h13.11l6.55-11.5" />
                    </svg>
                    {t.downloadDriveBtn}
                  </>
                )}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]"></div>
              </button>
              {!isExporting && (
                <p className="text-[11px] text-foreground/50 font-sans text-center -mt-1 px-4 leading-tight mb-2">
                  {t.driveHelpText}
                </p>
              )}
            </>
          )}
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
          <h2 className="text-3xl font-serif mb-2">{t.screenshotTitle}</h2>
          <p className="text-white/70 max-w-md">{t.screenshotDesc}</p>
        </div>
      )}

      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-surface/80 backdrop-blur-md border-b border-white/10 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-2xl font-serif text-foreground tracking-wide">{project.clientName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 font-sans">
              <span className="text-[11px] md:text-xs text-foreground/70 bg-surface-alt/70 px-2.5 py-0.5 rounded-full border border-border flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                {t.photosUploaded(photos.length)}
              </span>
              {activeSubToken ? (
                <span className="text-[10px] md:text-xs bg-accent/10 text-accent font-semibold px-2.5 py-0.5 rounded-full border border-accent/20">
                  {activeSubToken.name} ({t.photosCountLabel(activeSubToken.maxPhotos)})
                </span>
              ) : (
                <span className="text-[10px] md:text-xs text-foreground/50 uppercase tracking-widest hidden sm:inline">
                  {t.exclusiveSelection}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {/* Language Switch Button */}
            <button 
              onClick={toggleLang}
              className="h-9 px-3 flex items-center justify-center gap-1.5 rounded-full bg-surface-alt/80 border border-white/20 text-foreground hover:bg-surface-alt transition-all cursor-pointer backdrop-blur-sm font-sans text-xs font-semibold shadow-sm"
              title={t.switchLangTitle}
            >
              <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.6 9h16.8M3.6 15h16.8" />
              </svg>
              <span>{t.switchLangBtn}</span>
            </button>
            <button 
              onClick={() => setShowPriceList(true)}
              className="w-9 h-9 md:w-auto md:px-4 flex items-center justify-center gap-2 rounded-full bg-surface-alt/50 border border-white/20 text-foreground/80 hover:bg-surface-alt transition-all cursor-pointer backdrop-blur-sm"
              title={t.extraPrices}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
              <span className="hidden md:inline text-sm font-medium">{t.extraPrices}</span>
            </button>
            <button 
              onClick={() => setShowEditorModal(true)}
              className="w-9 h-9 md:w-auto md:px-4 flex items-center justify-center gap-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 hover:bg-purple-500/20 transition-all cursor-pointer backdrop-blur-sm"
              title={t.requestEditor}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              <span className="hidden md:inline text-sm font-medium">{t.requestEditor}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Action Bar (Bottom Pill) */}
      <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[600px] z-50">
        <div className="bg-surface/90 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full p-2 flex items-center justify-between transition-all duration-300">
          <div className="flex items-center pl-4 gap-3 md:gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-foreground/50 uppercase tracking-widest font-medium">{t.selected}</span>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-serif leading-none ${selectedPhotos.size > activeMaxPhotos ? "text-accent" : "text-foreground"}`}>
                  {selectedPhotos.size}
                </span>
                <span className="text-sm text-foreground/40">/ {activeMaxPhotos}</span>
              </div>
            </div>

            <div className="h-8 w-[1px] bg-border/50 mx-1 hidden sm:block"></div>
            <div className="hidden sm:flex flex-col">
              <span className="text-[10px] text-foreground/50 uppercase tracking-widest font-medium">{t.totalGDrive}</span>
              <span className="text-sm font-semibold text-foreground/80 leading-none">{t.photosCountShort(photos.length)}</span>
            </div>

            {grandTotal > 0 && (
              <div className="h-8 w-[1px] bg-border/50 mx-1"></div>
            )}
            {grandTotal > 0 && (
              <div className="flex flex-col animate-in fade-in slide-in-from-left-2">
                <span className="text-[10px] text-accent/70 uppercase tracking-widest font-medium">{t.bill}</span>
                <span className="text-sm font-bold text-accent leading-none">Rp {(grandTotal/1000).toLocaleString('id-ID')}k</span>
              </div>
            )}
          </div>
          
          <button 
            onClick={handleConfirm}
            disabled={selectedPhotos.size === 0 && Object.keys(selectedAddons).length === 0}
            className="bg-accent text-white px-6 md:px-8 py-3.5 rounded-full font-medium hover:bg-accent-dark transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-[0_4px_14px_rgba(var(--accent-rgb),0.4)] hover:shadow-[0_6px_20px_rgba(var(--accent-rgb),0.6)] hover:-translate-y-0.5 active:translate-y-0"
          >
            {t.confirm}
          </button>
        </div>
      </div>

      {/* Top spacing to compensate for fixed header */}
      <div className="h-24 md:h-28"></div>

      {/* Warning Banner if Over Limit */}
      {selectedPhotos.size > activeMaxPhotos && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="bg-accent/10 border border-accent/20 text-accent py-3 px-6 rounded-2xl text-center text-sm font-sans flex flex-col md:flex-row items-center justify-center gap-2 animate-in slide-in-from-top-4 fade-in duration-500 shadow-sm">
            <span>{t.overLimitText(extraPhotosCount, activeMaxPhotos)}</span>
            <span className="hidden md:inline">•</span>
            <span className="font-bold">{t.extraCostText(totalExtraCost.toLocaleString('id-ID'))}</span>
          </div>
        </div>
      )}

      {/* Tip for users */}
      <div className="max-w-7xl mx-auto px-4 mb-8 flex justify-center">
        <p className="text-xs text-foreground/50 font-sans italic bg-surface-alt/50 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm shadow-sm inline-block">
          {t.hintTip}
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
            <h3 className="text-xl font-serif text-foreground mb-2">{t.noPhotosTitle}</h3>
            <p className="text-foreground/60 max-w-md mx-auto text-sm">
              {t.noPhotosDesc}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 pb-32">
          {photos.map((photo, index) => {
            const isSelected = selectedPhotos.has(photo.id);
            // Stagger delay dikurangi: max 8 foto × 25ms = 200ms (was 600ms)
            const animationDelay = `${(index % 8) * 25}ms`;

            return (
              <div
                key={photo.id}
                onPointerDown={() => startPress(photo)}
                onPointerUp={() => endPress(photo.id)}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onTouchMove={cancelPress}
                onContextMenu={(e) => { e.preventDefault(); cancelPress(); }}
                className={`relative aspect-[3/4] cursor-pointer group rounded-2xl overflow-hidden transition-all duration-300 ease-out animate-in fade-in ${
                  isSelected ? 'scale-[0.93] shadow-lg shadow-accent/20' : 'hover:scale-[0.98] hover:shadow-md bg-surface-alt'
                }`}
                style={{
                  animationDelay,
                  animationFillMode: 'both',
                  willChange: 'transform', // GPU compositing untuk scroll halus
                }}
              >
                {/* Border selected state */}
                <div className={`absolute inset-0 z-20 pointer-events-none rounded-2xl border-4 transition-colors duration-300 ${
                  isSelected ? 'border-accent' : 'border-transparent'
                }`} />

                {/* Watermark CSS */}
                <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden opacity-[0.25] mix-blend-overlay flex items-center justify-center">
                  <div className="transform -rotate-45 font-black text-white text-3xl sm:text-4xl whitespace-nowrap tracking-widest uppercase drop-shadow-lg select-none">
                    Zeey Studio
                  </div>
                </div>

                {/* LazyImage: hanya load saat masuk viewport */}
                <LazyImage src={photo.thumbnailUrl} fallbackSrc={photo.fallbackUrl || `/api/drive/image?id=${photo.id}&sz=s300`} alt={photo.name} />

                {/* Selection Indicator */}
                <div className={`absolute top-3 right-3 md:top-4 md:right-4 w-7 h-7 md:w-8 md:h-8 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-300 z-30 ${
                  isSelected
                    ? 'bg-accent border-accent text-white scale-110 shadow-[0_2px_10px_rgba(var(--accent-rgb),0.5)]'
                    : 'border-white/80 bg-black/30 group-hover:bg-black/50 backdrop-blur-sm'
                }`}>
                  <svg className={`w-4 h-4 md:w-5 md:h-5 transition-transform duration-300 ${
                    isSelected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
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
            {/* Gunakan previewUrl (Drive CDN s1000) atau fallback s1000 proxy untuk fullscreen */}
            <SecureImage src={viewingPhoto.previewUrl || viewingPhoto.fullUrl} fallbackSrc={viewingPhoto.fallbackUrl || `/api/drive/image?id=${viewingPhoto.id}&sz=s1000`} alt={viewingPhoto.name} isFullscreen={true} />
            
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8">
              <h2 className="text-3xl mb-2 font-serif">{t.invoiceTitle}</h2>
              <p className="text-foreground/70 font-sans mb-8">
                {t.invoiceDesc}
              </p>
              
              <div className="space-y-4 mb-8 font-sans">
                <div className="flex justify-between text-sm pb-4 border-b border-border">
                  <span className="text-foreground/70">{t.includedLimit}</span>
                  <span className="font-medium">{t.photosCountLabel(project.maxPhotos)}</span>
                </div>
                <div className="flex justify-between text-sm pb-4 border-b border-border">
                  <span className="text-foreground/70">{t.totalSelected}</span>
                  <span className="font-medium">{t.photosCountLabel(selectedPhotos.size)}</span>
                </div>
                {basePackagePrice > 0 && (
                  <div className="flex justify-between text-sm pb-4 border-b border-border">
                    <span className="text-foreground/70">{t.packageLabel(project.packageName || 'Kustom')}</span>
                    <span className="font-medium">Rp {basePackagePrice.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {extraPhotosCount > 0 && (
                  <div className="flex justify-between text-sm pb-4 border-b border-border">
                    <span className="text-foreground/70">{t.extraPhotosLabel(extraPhotosCount, activeExtraPhotoPrice.toLocaleString('id-ID'))}</span>
                    <span className="font-medium">Rp {extraPhotosCost.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {Object.entries(selectedAddons).map(([id, qty]) => {
                  const item = priceList.find(p => p.id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="flex justify-between text-sm pb-4 border-b border-border">
                      <span className="text-foreground/70">
                        {item.name} ({qty} x {item.scheme === 'sudah bayar' ? t.alreadyPaid : `Rp ${item.price.toLocaleString('id-ID')}`})
                      </span>
                      <span className={`font-medium ${item.scheme === 'sudah bayar' ? 'text-emerald-600' : ''}`}>
                        {item.scheme === 'sudah bayar' ? 'Rp 0' : `Rp ${(item.price * qty).toLocaleString('id-ID')}`}
                      </span>
                    </div>
                  );
                })}
                {dpAmount > 0 && (
                  <div className="flex justify-between text-sm pb-4 border-b border-border text-green-600">
                    <span>{t.dpAmountLabel}</span>
                    <span className="font-medium">- Rp {dpAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl pt-2 font-serif">
                  <span>{t.remainingBill}</span>
                  <span className="text-accent">Rp {grandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Notice jika Midtrans sedang review */}
              {midtransReviewNotice && (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 p-4 rounded-2xl text-xs font-sans mb-6 flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <strong className="block font-semibold mb-0.5">{t.midtransReviewNoticeTitle}</strong>
                    <span>{midtransReviewNotice}</span>
                  </div>
                </div>
              )}

              {/* Transfer Manual (Bank & E-Wallet) Card */}
              {project.paymentProofStatus === 'pending' ? (
                <div className="bg-surface-alt border border-border rounded-2xl p-6 text-center animate-in fade-in zoom-in mb-6">
                  <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                  </div>
                  <h3 className="font-serif text-lg mb-1 text-foreground">{t.awaitingAdminTitle}</h3>
                  <p className="text-xs font-sans text-foreground/60">
                    {t.awaitingAdminDesc}
                  </p>
                </div>
              ) : project.paymentProofStatus === 'rejected' ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center animate-in fade-in zoom-in mb-6">
                  <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </div>
                  <h3 className="font-serif text-lg mb-1 text-red-900">{t.proofInvalidTitle}</h3>
                  <p className="text-xs font-sans text-red-700 mb-4">
                    {t.proofInvalidDesc}
                  </p>
                  <button 
                    onClick={handleWhatsAppConfirmAsync}
                    className="w-full px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-medium font-sans rounded-xl text-xs flex items-center justify-center gap-2"
                  >
                    {t.contactAdminWa}
                  </button>
                </div>
              ) : (
                <div className="w-full bg-surface-alt/70 border border-border rounded-2xl p-5 mb-6 font-sans">
                  <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-xl">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">{t.manualTransferTitle}</h4>
                        <p className="text-[11px] text-foreground/60">{t.manualTransferDesc}</p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-full">
                      {t.primaryActiveTag}
                    </span>
                  </div>

                  {manualBankInfo?.bankName || manualBankInfo?.accountNumber ? (
                    <div className="space-y-2.5 mb-4 text-xs">
                      <div className="flex justify-between items-center bg-surface p-3 rounded-xl border border-border">
                        <div>
                          <span className="text-foreground/50 block text-[10px] uppercase font-medium">{t.bankOrEwallet}</span>
                          <span className="font-bold text-foreground text-sm">{manualBankInfo.bankName || "BCA / Bank Transfer"}</span>
                        </div>
                        {manualBankInfo.accountName && (
                          <div className="text-right">
                            <span className="text-foreground/50 block text-[10px] uppercase font-medium">{t.accountName}</span>
                            <span className="font-medium text-foreground">{manualBankInfo.accountName}</span>
                          </div>
                        )}
                      </div>

                      {manualBankInfo.accountNumber && (
                        <div className="flex justify-between items-center bg-surface p-3 rounded-xl border border-border">
                          <div>
                            <span className="text-foreground/50 block text-[10px] uppercase font-medium">{t.accountNumber}</span>
                            <span className="font-mono font-bold text-base text-accent tracking-wider">{manualBankInfo.accountNumber}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(manualBankInfo.accountNumber);
                              setCopiedBank(true);
                              setTimeout(() => setCopiedBank(false), 2000);
                            }}
                            className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            {copiedBank ? t.copied : t.copyNo}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Tombol WA Konfirmasi */}
                  {studioWaUrl ? (
                    <a 
                      href={studioWaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleWhatsAppConfirmAsync}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-sans text-center transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                      {t.confirmViaWa}
                    </a>
                  ) : (
                    <button 
                      onClick={handleWhatsAppConfirmAsync}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-sans text-center transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      {t.confirmViaWa}
                    </button>
                  )}

                  {/* Midtrans Snap Secondary Trigger (tetap ada jika token siap) */}
                  {snapToken && (
                    <div className="mt-4 pt-3 border-t border-border/50 text-center">
                      <button 
                        type="button"
                        onClick={() => triggerSnapPayment(snapToken)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium underline cursor-pointer"
                      >
                        {t.payViaMidtrans}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Auto-verification notice */}
              {qrisString && !isMockPayment && (
                <div className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 mb-5 font-sans">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    {t.autoVerificationNotice}
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
                    {t.closeBtn}
                  </button>
                  {isMockPayment && (
                    <button
                      onClick={handlePaymentSuccess}
                      className="flex-1 py-3 bg-accent text-white rounded-xl font-medium text-sm hover:bg-accent-dark transition-colors font-sans shadow-md cursor-pointer"
                    >
                      {t.simulatedSuccessBtn}
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
              <h2 className="text-2xl font-serif">{t.officialPricelist}</h2>
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
                <p className="text-center text-foreground/60 font-sans py-4">{t.emptyPricelist}</p>
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
                {t.closeBtn}
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
              <h2 className="text-2xl font-serif mb-2 text-foreground">{t.editorModalTitle}</h2>
              <p className="text-foreground/70 font-sans text-sm mb-6">
                {t.editorModalDesc}
              </p>
              
              {editorRequestSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-center mb-4 flex flex-col items-center">
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="font-medium">{t.requestSuccessTitle}</span>
                  <span className="text-sm mt-1">{t.requestSuccessDesc}</span>
                </div>
              ) : (
                <form onSubmit={handleEditorRequestSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">{t.specialNotesLabel}</label>
                    <textarea 
                      value={editorNotes}
                      onChange={(e) => setEditorNotes(e.target.value)}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all resize-none h-32"
                      placeholder={t.specialNotesPlaceholder}
                    />
                  </div>
                  
                  <div className="flex gap-4 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowEditorModal(false)}
                      className="flex-1 py-3 border border-border rounded-xl hover:bg-surface-alt transition-colors cursor-pointer font-medium"
                    >
                      {t.cancelBtn}
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmittingEditor}
                      className="flex-1 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors cursor-pointer font-medium shadow-md disabled:opacity-70 flex justify-center items-center"
                    >
                      {isSubmittingEditor ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        t.submitRequestBtn
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* SubToken Selector Modal (if project has subTokens but no active token selected) */}
      {showSubTokenSelector && project?.subTokens && project.subTokens.length > 0 && !activeSubToken && (
        <div className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              👤
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-serif text-foreground">{t.selectNameTitle}</h3>
              <p className="text-xs text-foreground/60 mt-1 font-sans">
                {t.selectNameDesc(project.clientName)}
              </p>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 text-left font-sans">
              {project.subTokens.map((st, idx) => (
                <button
                  key={st.id}
                  onClick={() => {
                    setActiveSubToken(st);
                    if (st.selectedPhotoIds && st.selectedPhotoIds.length > 0) {
                      setSelectedPhotos(new Set(st.selectedPhotoIds));
                    }
                    setShowSubTokenSelector(false);
                    if (typeof window !== "undefined") {
                      window.history.replaceState(null, '', `${window.location.pathname}?token=${st.id}`);
                    }
                  }}
                  className="w-full p-4 rounded-2xl border border-border hover:border-accent/40 bg-surface-alt/40 hover:bg-accent/5 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <h4 className="font-semibold text-foreground text-sm group-hover:text-accent transition-colors">{st.name}</h4>
                    <p className="text-xs text-foreground/60">{t.quotaText(st.maxPhotos)}</p>
                  </div>
                  <span className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-xl group-hover:bg-accent group-hover:text-white transition-all">
                    {t.selectThis}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowSubTokenSelector(false)}
              className="w-full py-2 text-xs text-foreground/60 hover:text-foreground underline font-medium cursor-pointer"
            >
              {t.viewMainGallery(project.maxPhotos)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
