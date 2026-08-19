"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, query, orderBy } from "firebase/firestore";

import MultiTokenModal, { SubToken } from "@/components/MultiTokenModal";
import GDriveUploadModal from "@/components/GDriveUploadModal";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  clientEmail?: string;
  gdriveLinkHighRes?: string;
  maxPhotos: number;
  subTokens?: SubToken[];
  createdAt: string;
  gdriveFolderId?: string;
  status: 'Menunggu Pembayaran' | 'Lunas' | 'Selesai Difoto' | 'Menunggu Pemilihan' | 'File Terkirim';
  createdBy: string;
  shootDate?: string;
  shootTime?: string;
  packageId?: string;
  packageName?: string;
  packagePrice?: number;
  assignedAdmin?: string;
  dpAmount?: number;
  
  // CRM Fields
  clientType?: 'Reguler' | 'VIP' | 'Blacklist';
  leadSource?: string;
  socialMedia?: string;
  specialNotes?: string;
};

function CreateBookingForm() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  
  const [clientName, setClientName] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  
  const [shootDate, setShootDate] = useState(dateParam || "");
  const [shootTime, setShootTime] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [maxPhotos, setMaxPhotos] = useState<number | "">("");
  const [assignedAdmin, setAssignedAdmin] = useState("");
  const [dpAmount, setDpAmount] = useState<number | "">("");

  const [clientType, setClientType] = useState<'Reguler' | 'VIP' | 'Blacklist'>("Reguler");
  const [leadSource, setLeadSource] = useState("");
  const [customLeadSource, setCustomLeadSource] = useState("");
  const [socialMedia, setSocialMedia] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");

  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedProject, setGeneratedProject] = useState<Project | null>(null);
  const [isMultiTokenOpen, setIsMultiTokenOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCreatingFolderInSuccess, setIsCreatingFolderInSuccess] = useState(false);

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenGDriveInSuccess = async () => {
    if (!generatedProject) return;

    const { formatGDriveUrl } = await import("@/lib/drive-utils");

    if (generatedProject.gdriveLinkHighRes) {
      window.open(formatGDriveUrl(generatedProject.gdriveLinkHighRes), '_blank');
      return;
    }

    // Open new tab synchronously to bypass browser popup blockers
    const newTab = window.open('about:blank', '_blank');

    setIsCreatingFolderInSuccess(true);
    try {
      const folderRes = await fetch('/api/drive/create-project-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: generatedProject.clientName })
      });
      const folderData = await folderRes.json();

      if (folderData.success && folderData.folderId) {
        const link = `https://drive.google.com/drive/folders/${folderData.folderId}`;
        const { updateDoc, doc } = await import("firebase/firestore");
        await updateDoc(doc(db, "projects", generatedProject.id), {
          gdriveLinkHighRes: link,
          gdriveFolderId: folderData.folderId
        });
        setGeneratedProject(prev => prev ? { ...prev, gdriveLinkHighRes: link, gdriveFolderId: folderData.folderId } : null);
        
        if (newTab) {
          newTab.location.href = link;
        } else {
          window.open(link, '_blank');
        }
      } else {
        const manualLink = prompt(
          `Pembuatan folder otomatis memerlukan backend Google Drive API.\n\nSilakan buat/buka folder Google Drive untuk ${generatedProject.clientName}, lalu tempelkan (paste) Link Folder Google Drive di sini:`
        );
        if (manualLink) {
          const folderIdMatch = manualLink.match(/folders\/([a-zA-Z0-9-_]+)/) || manualLink.match(/id=([a-zA-Z0-9-_]+)/);
          const folderId = folderIdMatch ? folderIdMatch[1] : manualLink;
          const fullUrl = formatGDriveUrl(manualLink);
          const { updateDoc, doc } = await import("firebase/firestore");
          await updateDoc(doc(db, "projects", generatedProject.id), {
            gdriveLinkHighRes: fullUrl,
            gdriveFolderId: folderId
          });
          setGeneratedProject(prev => prev ? { ...prev, gdriveLinkHighRes: fullUrl, gdriveFolderId: folderId } : null);
          
          if (newTab) {
            newTab.location.href = fullUrl;
          } else {
            window.open(fullUrl, '_blank');
          }
        } else {
          const driveHome = 'https://drive.google.com/drive/my-drive';
          if (newTab) {
            newTab.location.href = driveHome;
          } else {
            window.open(driveHome, '_blank');
          }
        }
      }
    } catch (err) {
      console.error(err);
      const driveHome = 'https://drive.google.com/drive/my-drive';
      if (newTab) {
        newTab.location.href = driveHome;
      } else {
        window.open(driveHome, '_blank');
      }
    } finally {
      setIsCreatingFolderInSuccess(false);
    }
  };
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [priceList, setPriceList] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [authRole, setAuthRole] = useState("");
  
  const editParam = searchParams.get('edit');
  const [existingProject, setExistingProject] = useState<Project | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentRole = localStorage.getItem("zeey_auth_role") || "";
        setAuthRole(currentRole);
        
        // Load Admins
        const adminSnap = await getDocs(collection(db, "admins"));
        const admins = adminSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAdminsList(admins);

        // Load Pricelist
        const priceSnap = await getDocs(collection(db, "pricelist"));
        const pricesMap = new Map<string, any>();
        priceSnap.docs.forEach(d => {
          const data = d.data();
          const itemId = data.id || d.id;
          if (!pricesMap.has(itemId)) {
            pricesMap.set(itemId, { ...data, id: itemId });
          }
        });
        let prices = Array.from(pricesMap.values());
        setPriceList(prices);
        
        if (editParam) {
          const { getDoc } = await import("firebase/firestore");
          const pDoc = await getDoc(doc(db, "projects", editParam));
          if (pDoc.exists()) {
            const data = pDoc.data() as Project;
            setExistingProject(data);
            setClientName(data.clientName || "");
            setWaNumber(data.waNumber || "");
            setClientEmail(data.clientEmail || "");
            setShootDate(data.shootDate || "");
            setShootTime(data.shootTime || "");
            if (data.packageId) setSelectedPackage(data.packageId);
            setMaxPhotos(data.maxPhotos || "");
            setAssignedAdmin(data.assignedAdmin || "");
            setClientType(data.clientType || "Reguler");
            setLeadSource(data.leadSource || "");
            setSocialMedia(data.socialMedia || "");
            setSpecialNotes(data.specialNotes || "");
            setDpAmount(data.dpAmount || "");
          }
        }
      } catch (err) {
        console.error("Failed to load options", err);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    
    const slug = clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const shortHash = Math.random().toString(36).substring(2, 6);
    const id = slug ? `${slug}-${shortHash}` : shortHash;
    
    const pkg = priceList.find(p => p.id === selectedPackage);

    const projectData: any = {
      clientName,
      waNumber,
      maxPhotos: Number(maxPhotos) || 0,
      shootDate,
      shootTime,
      packageId: pkg?.id || "",
      packageName: pkg?.name || "",
      packagePrice: pkg?.price || 0,
      assignedAdmin: assignedAdmin,
      clientType,
      leadSource: leadSource === "Lainnya" ? customLeadSource.trim() : leadSource,
      dpAmount: Number(dpAmount) || 0
    };

    // Hanya tambahkan field opsional jika ada nilainya (Firestore tidak menerima undefined)
    if (clientEmail.trim()) projectData.clientEmail = clientEmail.trim();
    if (socialMedia.trim()) projectData.socialMedia = socialMedia.trim();
    if (specialNotes.trim()) projectData.specialNotes = specialNotes.trim();

    try {
      if (editParam && existingProject) {
        const { updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "projects", editParam), projectData);
        
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Edit Pesanan", `Mengubah data pesanan klien ${clientName} (${editParam})`);
        
        alert("Pesanan berhasil diperbarui!");
        window.location.href = '/dashboard/bookings';
      } else {
        let finalLinkHighRes = "";
        let finalFolderId = "";

        // Auto create Google Drive Folder
        try {
          const folderRes = await fetch('/api/drive/create-project-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientName })
          });
          const folderData = await folderRes.json();
          if (folderData.success && folderData.folderId) {
            finalFolderId = folderData.folderId;
            finalLinkHighRes = `https://drive.google.com/drive/folders/${finalFolderId}`;
          }
        } catch (e) {
          console.error("Gagal membuat folder otomatis:", e);
        }

        const newProject: Project = {
          ...projectData,
          id,
          createdAt: new Date().toISOString(),
          status: 'Menunggu Pembayaran',
          createdBy: localStorage.getItem('zeey_auth_user') || 'Owner',
        };

        if (finalFolderId) {
          newProject.gdriveFolderId = finalFolderId;
          newProject.gdriveLinkHighRes = finalLinkHighRes;
        }

        await setDoc(doc(db, "projects", id), newProject);

        const link = `${window.location.origin}/client/${id}`;
        setGeneratedLink(link);
        setGeneratedProject(newProject);
        
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Buat Pesanan", `Membuat pesanan baru untuk klien ${clientName} (${id})`);
        
        // Reset form
        setClientName("");
        setWaNumber("");
        setClientEmail("");
        setShootDate("");
        setShootTime("");
        setSelectedPackage("");
        setMaxPhotos("");
        setAssignedAdmin("");
        setClientType("Reguler");
        setLeadSource("");
        setCustomLeadSource("");
        setSocialMedia("");
        setSpecialNotes("");
        setDpAmount("");
      }
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
    const message = `Halo ${generatedProject.clientName},\n\nTerima kasih telah melakukan booking di Zeey Studio!\n\nJadwal Anda: ${generatedProject.shootDate} jam ${generatedProject.shootTime}\nPaket: ${generatedProject.packageName || '-'}\n\nSilakan cek detail pesanan dan status Anda di sini: ${generatedLink}`;
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  };

  return (
    <Sidebar>
      <div className="p-4 md:p-8 lg:p-10 max-w-3xl mx-auto w-full pb-24 animate-in fade-in duration-500">
        <div className="mb-8 border-b border-border/50 pb-6">
          <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">
            {editParam ? "Edit Booking" : "Buat Booking Baru"}
          </h1>
          <p className="text-foreground/70 font-sans text-sm md:text-base">
            {editParam ? "Perbarui detail pesanan klien." : "Daftarkan pesanan klien, atur jadwal, dan tugaskan fotografer."}
          </p>
        </div>

        <div className="space-y-6 md:space-y-8">
          {isLoadingData ? (
             <div className="bg-surface border border-border p-6 md:p-8 rounded-3xl shadow-sm flex justify-center items-center h-40">
               <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
             </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
            {/* SECTION 1: DATA KLIEN */}
            <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="bg-surface-alt/50 border-b border-border p-5 md:p-6 flex items-center gap-3">
                <div className="bg-accent/10 text-accent p-2.5 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </div>
                <h2 className="text-xl font-serif text-foreground">Data Klien</h2>
              </div>
              <div className="p-5 md:p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Nama Klien</label>
                    <input type="text" required className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g., John & Jane" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">WhatsApp Number</label>
                    <input type="tel" required className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50" value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="e.g., 08123456789" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Email Klien (Opsional)</label>
                    <input type="email" className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="e.g., client@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Tipe Klien</label>
                    <select className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50 appearance-none cursor-pointer" value={clientType} onChange={(e) => setClientType(e.target.value as any)}>
                      <option value="Reguler">Reguler</option>
                      <option value="VIP">VIP</option>
                      <option value="Blacklist">Blacklist</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: DETAIL PESANAN & JADWAL */}
            <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="bg-surface-alt/50 border-b border-border p-5 md:p-6 flex items-center gap-3">
                <div className="bg-blue-500/10 text-blue-500 p-2.5 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <h2 className="text-xl font-serif text-foreground">Detail Pesanan & Jadwal</h2>
              </div>
              <div className="p-5 md:p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Paket Harga</label>
                    <select required className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50 appearance-none cursor-pointer" value={selectedPackage} onChange={(e) => setSelectedPackage(e.target.value)}>
                      <option value="">-- Pilih Paket --</option>
                      {priceList.filter(p => !p.isSystem).map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Rp {p.price.toLocaleString('id-ID')})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Batas Maksimal Pilih Foto</label>
                    <input type="number" required min="1" className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50" value={maxPhotos} onChange={(e) => setMaxPhotos(Number(e.target.value))} placeholder="e.g., 50" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Tanggal Pemotretan</label>
                    <input type="date" required className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50" value={shootDate} onChange={(e) => setShootDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Jam Pemotretan</label>
                    <input type="time" required className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50" value={shootTime} onChange={(e) => setShootTime(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">DP / Uang Muka (Rp) (Opsional)</label>
                    <input type="number" min="0" className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50" value={dpAmount} onChange={(e) => setDpAmount(Number(e.target.value))} placeholder="e.g., 500000" />
                    <p className="text-xs text-foreground/50 mt-2 leading-relaxed">Jika klien sudah membayar uang muka (DP), masukkan nominalnya di sini agar terpotong dari total tagihan akhir.</p>
                  </div>
                  {authRole === "owner" && (
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground/80">Tugaskan Fotografer (Admin)</label>
                      <select className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50 appearance-none cursor-pointer" value={assignedAdmin} onChange={(e) => setAssignedAdmin(e.target.value)}>
                        <option value="">-- Pilih Fotografer --</option>
                        {adminsList.map(a => (
                          <option key={a.id} value={a.name}>{a.name} ({a.username})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: INFORMASI TAMBAHAN */}
            <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="bg-surface-alt/50 border-b border-border p-5 md:p-6 flex items-center gap-3">
                <div className="bg-emerald-500/10 text-emerald-500 p-2.5 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                </div>
                <h2 className="text-xl font-serif text-foreground">Informasi Tambahan</h2>
              </div>
              <div className="p-5 md:p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Sumber Klien (Lead Source)</label>
                    <select required className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50 appearance-none cursor-pointer" value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
                      <option value="">-- Pilih Sumber --</option>
                      <option value="Instagram">Instagram</option>
                      <option value="TikTok">TikTok</option>
                      <option value="Referensi Teman">Referensi Teman</option>
                      <option value="Iklan Facebook/IG">Iklan Facebook/IG</option>
                      <option value="Walk-in (Datang Langsung)">Walk-in (Datang Langsung)</option>
                      <option value="Lainnya">Lainnya...</option>
                    </select>
                    {leadSource === "Lainnya" && (
                      <input type="text" required placeholder="Sebutkan sumber klien..." className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50 mt-3 animate-in fade-in" value={customLeadSource} onChange={(e) => setCustomLeadSource(e.target.value)} />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Akun Instagram / TikTok</label>
                    <input type="text" className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50" value={socialMedia} onChange={(e) => setSocialMedia(e.target.value)} placeholder="e.g., @johndoe" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/80">Catatan / Preferensi Khusus</label>
                  <textarea className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all hover:border-accent/50 min-h-[120px] resize-y" value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} placeholder="e.g., Klien pemalu, konsep vintage, alergi makeup..." />
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {errorMsg}
              </div>
            )}

            <div className="pt-4">
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-accent text-white py-4 md:py-4.5 rounded-2xl font-medium hover:bg-accent-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-base md:text-lg cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Memproses...
                  </>
                ) : (
                  editParam ? 'Simpan Perubahan' : 'Buat Pesanan & Jadwal'
                )}
              </button>
            </div>
          </form>
          )}

          {generatedLink && generatedProject && (
            <div className="mt-8 bg-surface border border-border rounded-2xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-emerald-500/10 border-b border-border p-5 md:p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500 text-white p-2 rounded-full shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-foreground font-semibold">Pesanan & Jadwal Berhasil Dibuat!</h3>
                    <p className="text-xs text-foreground/60">ID: {generatedProject.id} &bull; Klien: {generatedProject.clientName}</p>
                  </div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-medium">
                  Sukses
                </span>
              </div>

              <div className="p-5 md:p-6 space-y-5">
                {/* Link Bar & Salin Tautan */}
                <div>
                  <label className="block text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-2">Tautan Galeri Klien</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={generatedLink} 
                      className="w-full p-3.5 bg-background border border-border rounded-xl text-sm font-mono text-foreground/80 outline-none focus:border-accent transition-all"
                    />
                    <button 
                      type="button"
                      onClick={handleCopyLink}
                      className="px-5 py-3.5 border border-border rounded-xl bg-surface-alt hover:bg-border transition-colors whitespace-nowrap text-sm font-semibold cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedLink ? (
                        <span className="text-emerald-600 font-bold">Tersalin ✓</span>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                          Salin Tautan
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Status Indicator Folder GDrive */}
                {generatedProject.gdriveFolderId ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    <span>Folder Google Drive klien <strong>({generatedProject.clientName})</strong> berhasil dibuat otomatis beserta sub-folder foto!</span>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-xl text-xs flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <span>Folder Google Drive belum dibuat. Tekan <strong>Upload Foto (Buka GDrive)</strong> di bawah untuk buat folder.</span>
                  </div>
                )}

                {/* Grid Tombol Aksi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 font-sans">
                  {/* 1. Upload Foto (Buka GDrive) */}
                  <button 
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 text-center py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    Upload Foto (Buka GDrive)
                  </button>

                  {/* 2. Sub-Token (Bagi Token Link) */}
                  <button
                    type="button"
                    onClick={() => setIsMultiTokenOpen(true)}
                    className="bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 text-center py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                    {generatedProject.subTokens && generatedProject.subTokens.length > 0 ? `Sub-Token (${generatedProject.subTokens.length} Link)` : 'Sub-Token (Bagi Token Link)'}
                  </button>

                  {/* 3. Buka Galeri */}
                  <Link
                    href={`/client/${generatedProject.id}`}
                    target="_blank"
                    className="bg-surface-alt hover:bg-border text-foreground border border-border text-center py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    Buka Galeri
                  </Link>

                  {/* 4. Kirim via WhatsApp */}
                  <a 
                    href={createWhatsAppLink()} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-[#25D366] text-white text-center py-3 px-4 rounded-xl text-sm font-semibold hover:bg-[#20bd5a] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    Kirim via WhatsApp
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <MultiTokenModal
        isOpen={isMultiTokenOpen}
        onClose={() => setIsMultiTokenOpen(false)}
        project={generatedProject}
        onProjectUpdated={() => {
          if (generatedProject && generatedProject.id) {
            import("firebase/firestore").then(({ getDoc, doc }) => {
              getDoc(doc(db, "projects", generatedProject.id)).then(snap => {
                if (snap.exists()) setGeneratedProject({ id: snap.id, ...snap.data() } as Project);
              });
            });
          }
        }}
      />
      <GDriveUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        project={generatedProject}
        onProjectUpdated={(updated) => {
          if (updated) setGeneratedProject(updated);
        }}
      />
    </Sidebar>
  );
}

export default function CreateBookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Memuat form...</div>}>
      <CreateBookingForm />
    </Suspense>
  );
}
