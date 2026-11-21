"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { BentoCard, Field, Icon, INPUT, PageHeader, SkeletonBlock } from "@/components/ui";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { normalizeWaNumber } from "@/lib/phone";
import { authFetch } from "@/lib/auth-client";
import { collection, doc, setDoc, getDoc, getDocs, query, orderBy, where } from "firebase/firestore";

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

const LEAD_SOURCES = [
  { value: "Instagram", label: "Instagram" },
  { value: "TikTok", label: "TikTok" },
  { value: "Referensi Teman", label: "Referensi" },
  { value: "Iklan Facebook/IG", label: "Iklan" },
  { value: "Walk-in (Datang Langsung)", label: "Walk-in" },
  { value: "Lainnya", label: "Lainnya" },
];

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-foreground/55 shrink-0">{label}</dt>
      <dd className={`text-right font-semibold ${tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}

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
      const folderRes = await authFetch('/api/drive/create-project-folder', {
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
        // Daftar fotografer hanya dapat dibaca Owner (Firestore Security Rules)
        if (currentRole === "owner") {
          const adminSnap = await getDocs(collection(db, "admins"));
          const admins = adminSnap.docs.map(d => ({ id: d.id, name: d.data().name, username: d.data().username }));
          setAdminsList(admins);
        }

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

    if (!leadSource) {
      setErrorMsg("Pilih dulu sumber klien (dari mana klien mengenal studio).");
      setIsSubmitting(false);
      return;
    }
    
    const slug = clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const makeId = () => {
      const shortHash = Math.random().toString(36).substring(2, 6);
      return slug ? `${slug}-${shortHash}` : shortHash;
    };
    let id = makeId();

    // ── Validasi sebelum menyimpan: jadwal bentrok & klien Blacklist ──
    try {
      const warnings: string[] = [];
      if (shootDate && shootTime) {
        const sameDay = await getDocs(query(collection(db, "projects"), where("shootDate", "==", shootDate)));
        const clashes = sameDay.docs.filter(d => d.id !== editParam && d.data().shootTime === shootTime);
        if (clashes.length > 0) {
          warnings.push(`⚠️ Jadwal bentrok: sudah ada booking pada ${shootDate} jam ${shootTime} (${clashes.map(d => d.data().clientName).join(", ")}).`);
        }
      }
      if (!editParam && waNumber.trim()) {
        const target = normalizeWaNumber(waNumber);
        const blacklisted = await getDocs(query(collection(db, "projects"), where("clientType", "==", "Blacklist")));
        if (blacklisted.docs.some(d => normalizeWaNumber(d.data().waNumber) === target)) {
          warnings.push("⚠️ Nomor WhatsApp ini tercatat sebagai klien BLACKLIST di Data Klien.");
        }
      }
      if (warnings.length > 0 && !confirm(`${warnings.join("\n\n")}\n\nTetap lanjutkan menyimpan booking?`)) {
        setIsSubmitting(false);
        return;
      }
      // Pastikan ID proyek unik (ID dipakai pada tautan galeri klien)
      if (!editParam) {
        for (let attempt = 0; attempt < 5 && (await getDoc(doc(db, "projects", id))).exists(); attempt++) {
          id = makeId();
        }
      }
    } catch (validationErr) {
      console.warn("Validasi booking dilewati:", validationErr);
    }
    
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
          const folderRes = await authFetch('/api/drive/create-project-folder', {
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
    const cleanNumber = normalizeWaNumber(generatedProject.waNumber);
    const message = `Halo ${generatedProject.clientName},\n\nTerima kasih telah melakukan booking di Zeey Studio!\n\nJadwal Anda: ${generatedProject.shootDate} jam ${generatedProject.shootTime}\nPaket: ${generatedProject.packageName || '-'}\n\nSilakan cek detail pesanan dan status Anda di sini: ${generatedLink}`;
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  };

  // ── Ringkasan langsung (dihitung dari isian form) ──────────────────────────
  const pickedPackage = priceList.find((p) => p.id === selectedPackage);
  const packagePrice = Number(pickedPackage?.price) || 0;
  const dpValue = Number(dpAmount) || 0;
  const remaining = Math.max(0, packagePrice - dpValue);
  const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
  const scheduleLabel =
    shootDate
      ? `${new Date(shootDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}${shootTime ? ` · ${shootTime}` : ""}`
      : "Belum dipilih";

  return (
    <Sidebar>
      <div className="p-3.5 md:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-36 lg:pb-8">
        <PageHeader
          module="create"
          title={editParam ? "Edit Booking" : "Buat Booking Baru"}
          subtitle={editParam ? "Perbarui detail pesanan klien." : "Daftarkan pesanan klien, atur jadwal, dan tugaskan fotografer."}
        />

        {isLoadingData ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonBlock className="h-56 md:col-span-2" />
              <SkeletonBlock className="h-44" />
              <SkeletonBlock className="h-44" />
            </div>
            <SkeletonBlock className="h-72" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* ── Kolom kiri: kartu-kartu isian ─────────────────────────── */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
              {/* Data Klien */}
              <BentoCard
                className="md:col-span-2"
                tone="from-indigo-500 to-violet-500"
                glow="shadow-indigo-500/30"
                icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                title="Data Klien"
                desc="Identitas & kontak utama"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Field label="Nama Klien">
                    <input type="text" required className={INPUT} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Contoh: John & Jane" />
                  </Field>
                  <Field label="Nomor WhatsApp">
                    <input type="tel" required className={INPUT} value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="Contoh: 08123456789" />
                  </Field>
                  <Field label="Email Klien" optional>
                    <input type="email" className={INPUT} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Contoh: klien@email.com" />
                  </Field>
                  <Field label="Tipe Klien">
                    <div className="flex gap-2">
                      {(["Reguler", "VIP", "Blacklist"] as const).map((t) => {
                        const on = clientType === t;
                        const active =
                          t === "VIP"
                            ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white border-transparent shadow-md shadow-amber-500/30"
                            : t === "Blacklist"
                            ? "bg-gradient-to-br from-rose-500 to-red-600 text-white border-transparent shadow-md shadow-red-500/30"
                            : "bg-gradient-to-br from-sky-500 to-blue-600 text-white border-transparent shadow-md shadow-sky-500/30";
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setClientType(t)}
                            aria-pressed={on}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer press ${
                              on ? active : "bg-surface-alt/60 text-foreground/55 border-border/60 hover:text-foreground"
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>
              </BentoCard>

              {/* Jadwal */}
              <BentoCard
                tone="from-sky-500 to-blue-600"
                glow="shadow-sky-500/30"
                icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                title="Jadwal Pemotretan"
                desc="Tanggal & jam sesi"
              >
                <div className="space-y-3.5">
                  <Field label="Tanggal">
                    <input type="date" required className={INPUT} value={shootDate} onChange={(e) => setShootDate(e.target.value)} />
                  </Field>
                  <Field label="Jam">
                    <input type="time" required className={INPUT} value={shootTime} onChange={(e) => setShootTime(e.target.value)} />
                  </Field>
                </div>
              </BentoCard>

              {/* Paket & kuota */}
              <BentoCard
                tone="from-emerald-500 to-teal-500"
                glow="shadow-emerald-500/30"
                icon="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                title="Paket & Kuota"
                desc="Harga dan batas pilih foto"
              >
                <div className="space-y-3.5">
                  <Field label="Paket Harga">
                    <select required className={`${INPUT} appearance-none cursor-pointer`} value={selectedPackage} onChange={(e) => setSelectedPackage(e.target.value)}>
                      <option value="">— Pilih Paket —</option>
                      {priceList.filter((p) => !p.isSystem).map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({rupiah(Number(p.price) || 0)})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Batas Maksimal Pilih Foto">
                    <input type="number" required min="1" className={INPUT} value={maxPhotos} onChange={(e) => setMaxPhotos(Number(e.target.value))} placeholder="Contoh: 50" />
                  </Field>
                </div>
              </BentoCard>

              {/* Pembayaran & fotografer */}
              <BentoCard
                className={authRole === "owner" ? "md:col-span-2" : ""}
                tone="from-pink-500 to-rose-500"
                glow="shadow-pink-500/30"
                icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                title="Uang Muka & Petugas"
                desc="DP yang sudah diterima"
              >
                <div className={`grid grid-cols-1 gap-3.5 ${authRole === "owner" ? "sm:grid-cols-2" : ""}`}>
                  <Field label="DP / Uang Muka (Rp)" optional hint="Nominal ini otomatis mengurangi total tagihan klien.">
                    <input type="number" min="0" className={INPUT} value={dpAmount} onChange={(e) => setDpAmount(Number(e.target.value))} placeholder="Contoh: 500000" />
                  </Field>
                  {authRole === "owner" && (
                    <Field label="Tugaskan Fotografer">
                      <select className={`${INPUT} appearance-none cursor-pointer`} value={assignedAdmin} onChange={(e) => setAssignedAdmin(e.target.value)}>
                        <option value="">— Pilih Fotografer —</option>
                        {adminsList.map((a) => (
                          <option key={a.id} value={a.name}>{a.name} ({a.username})</option>
                        ))}
                      </select>
                    </Field>
                  )}
                </div>
              </BentoCard>

              {/* Sumber klien */}
              <BentoCard
                className="md:col-span-2"
                tone="from-amber-400 to-orange-500"
                glow="shadow-amber-500/30"
                icon="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                title="Sumber Klien"
                desc="Dari mana klien mengenal studio"
              >
                <div className="space-y-3.5">
                  <div className="flex flex-wrap gap-2">
                    {LEAD_SOURCES.map((s) => {
                      const on = leadSource === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setLeadSource(s.value)}
                          aria-pressed={on}
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer press ${
                            on
                              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white border-transparent shadow-md shadow-amber-500/30"
                              : "bg-surface-alt/60 text-foreground/55 border-border/60 hover:text-foreground"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {leadSource === "Lainnya" && (
                      <Field label="Sebutkan Sumbernya">
                        <input type="text" required className={INPUT} value={customLeadSource} onChange={(e) => setCustomLeadSource(e.target.value)} placeholder="Tulis sumber klien…" />
                      </Field>
                    )}
                    <Field label="Akun Instagram / TikTok" optional>
                      <input type="text" className={INPUT} value={socialMedia} onChange={(e) => setSocialMedia(e.target.value)} placeholder="Contoh: @johndoe" />
                    </Field>
                  </div>
                </div>
              </BentoCard>

              {/* Catatan */}
              <BentoCard
                className="md:col-span-2"
                tone="from-purple-500 to-fuchsia-500"
                glow="shadow-fuchsia-500/30"
                icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                title="Catatan Khusus"
                desc="Preferensi atau permintaan klien"
              >
                <textarea
                  className={`${INPUT} min-h-[110px] resize-y`}
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="Contoh: klien pemalu, konsep vintage, alergi makeup…"
                />
              </BentoCard>
            </div>

            {/* ── Kolom kanan: ringkasan melekat ────────────────────────── */}
            <aside className="lg:sticky lg:top-4 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="rounded-3xl bg-surface border border-border/70 shadow-sm overflow-hidden">
                <div className="bg-aurora px-4 py-3.5 text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/80">Ringkasan Pesanan</p>
                  <p className="mt-0.5 text-lg font-bold tracking-tight truncate">{clientName || "Klien baru"}</p>
                </div>
                <dl className="p-4 space-y-3 text-xs">
                  <SummaryRow label="Jadwal" value={scheduleLabel} />
                  <SummaryRow label="Paket" value={pickedPackage?.name || "Belum dipilih"} />
                  <SummaryRow label="Kuota foto" value={maxPhotos ? `${maxPhotos} foto` : "—"} />
                  <SummaryRow label="Fotografer" value={assignedAdmin || "Belum ditugaskan"} />
                  <div className="pt-3 border-t border-border/60 space-y-2">
                    <SummaryRow label="Harga paket" value={rupiah(packagePrice)} />
                    {dpValue > 0 && <SummaryRow label="DP diterima" value={`− ${rupiah(dpValue)}`} tone="emerald" />}
                    <div className="flex items-end justify-between gap-3 pt-1">
                      <span className="text-foreground/60">Sisa tagihan</span>
                      <span className="text-xl font-extrabold tracking-tight tabular-nums text-brand">{rupiah(remaining)}</span>
                    </div>
                  </div>
                </dl>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs font-medium animate-in fade-in zoom-in-95">
                  <Icon d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 shrink-0 mt-px" />
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full overflow-hidden bg-brand text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-violet-500/35 transition-all hover:brightness-110 hover:shadow-xl cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed hidden lg:flex items-center justify-center gap-2 press"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Memproses…
                  </>
                ) : (
                  <>
                    {editParam ? "Simpan Perubahan" : "Buat Pesanan & Jadwal"}
                    <Icon d="M14 5l7 7m0 0l-7 7m7-7H3" className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
                  </>
                )}
              </button>
              <p className="hidden lg:block text-center text-[11px] text-foreground/45 leading-snug">
                Tautan galeri & folder Google Drive dibuat otomatis setelah pesanan tersimpan.
              </p>
            </aside>

            {/* Bilah aksi melekat (HP): sisa tagihan + simpan, tanpa perlu menggulir ke bawah */}
            <div className="lg:hidden fixed inset-x-3 bottom-[calc(5.2rem+env(safe-area-inset-bottom))] z-30 px-3 py-2.5 rounded-2xl bg-surface/90 backdrop-blur-xl border border-border/60 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-foreground/50 leading-none">Sisa tagihan</p>
                  <p className="mt-1 text-base font-extrabold tracking-tight tabular-nums text-brand leading-none">{rupiah(remaining)}</p>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-brand text-white py-3 rounded-2xl font-bold text-sm shadow-lg shadow-violet-500/35 transition-all hover:brightness-110 cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2 press"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Memproses…
                    </>
                  ) : (
                    <>
                      {editParam ? "Simpan Perubahan" : "Buat Pesanan"}
                      <Icon d="M14 5l7 7m0 0l-7 7m7-7H3" className="w-4 h-4" strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {generatedLink && generatedProject && (
          <section className="mt-5 rounded-3xl bg-surface border border-border/70 shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-4 bg-emerald-500/10 border-b border-border/60">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                  <Icon d="M5 13l4 4L19 7" className="w-5 h-5" strokeWidth={2.8} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm md:text-base font-bold tracking-tight">Pesanan &amp; Jadwal Berhasil Dibuat!</h3>
                  <p className="text-[11px] text-foreground/55 truncate">ID: {generatedProject.id} &bull; Klien: {generatedProject.clientName}</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                Sukses
              </span>
            </div>

            <div className="p-4 md:p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-foreground/55 uppercase tracking-wider mb-1.5">Tautan Galeri Klien</label>
                <div className="flex items-center gap-2">
                  <input type="text" readOnly value={generatedLink} className={`${INPUT} font-mono text-xs`} />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 px-4 py-3 rounded-xl bg-surface-alt hover:bg-border border border-border/60 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 press"
                  >
                    {copiedLink ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Tersalin ✓</span>
                    ) : (
                      <>
                        <Icon d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" className="w-4 h-4 text-foreground/55" />
                        Salin
                      </>
                    )}
                  </button>
                </div>
              </div>

              {generatedProject.gdriveFolderId ? (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-700 dark:text-emerald-400">
                  <Icon d="M5 13l4 4L19 7" className="w-4 h-4 shrink-0 mt-px" strokeWidth={2.5} />
                  <span>Folder Google Drive klien <strong>({generatedProject.clientName})</strong> berhasil dibuat otomatis beserta sub-folder foto.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400">
                  <Icon d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" className="w-4 h-4 shrink-0 mt-px" />
                  <span>Folder Google Drive belum dibuat. Tekan <strong>Upload Foto (Buka GDrive)</strong> di bawah untuk membuatnya.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="py-3 px-4 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white text-xs font-bold shadow-md shadow-sky-500/25 transition-all hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer press"
                >
                  <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" className="w-4 h-4" />
                  Upload Foto (Buka GDrive)
                </button>

                <button
                  type="button"
                  onClick={() => setIsMultiTokenOpen(true)}
                  className="py-3 px-4 rounded-2xl bg-accent/10 hover:bg-accent/20 text-accent border border-accent/25 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer press"
                >
                  <Icon d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" className="w-4 h-4" />
                  {generatedProject.subTokens && generatedProject.subTokens.length > 0 ? `Sub-Token (${generatedProject.subTokens.length} Link)` : "Sub-Token (Bagi Link)"}
                </button>

                <Link
                  href={`/client/${generatedProject.id}`}
                  target="_blank"
                  className="py-3 px-4 rounded-2xl bg-surface-alt hover:bg-border border border-border/60 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer press"
                >
                  <Icon d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" className="w-4 h-4 text-foreground/55" />
                  Buka Galeri
                </Link>

                <a
                  href={createWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-bold shadow-md shadow-emerald-500/25 transition-all hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer press"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                  Kirim via WhatsApp
                </a>
              </div>
            </div>
          </section>
        )}
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-foreground/60">Memuat form…</div>}>
      <CreateBookingForm />
    </Suspense>
  );
}
