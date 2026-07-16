"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, query, orderBy } from "firebase/firestore";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  clientEmail?: string;
  gdriveLinkHighRes?: string;
  maxPhotos: number;
  createdAt: string;
  driveFolderId?: string;
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

  // CRM State
  const [clientType, setClientType] = useState<'Reguler' | 'VIP' | 'Blacklist'>("Reguler");
  const [leadSource, setLeadSource] = useState("");
  const [customLeadSource, setCustomLeadSource] = useState("");
  const [socialMedia, setSocialMedia] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");

  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedProject, setGeneratedProject] = useState<Project | null>(null);
  
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
            setDriveFolderId(data.driveFolderId || "");
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
      clientEmail: clientEmail.trim() || undefined,
      maxPhotos: Number(maxPhotos) || 0,
      shootDate,
      shootTime,
      packageId: pkg?.id,
      packageName: pkg?.name,
      packagePrice: pkg?.price,
      assignedAdmin: assignedAdmin,
      clientType,
      leadSource: leadSource === "Lainnya" ? customLeadSource.trim() : leadSource,
      socialMedia: socialMedia.trim() || undefined,
      specialNotes: specialNotes.trim() || undefined,
      driveFolderId: driveFolderId.trim() || undefined,
      dpAmount: Number(dpAmount) || 0
    };

    try {
      if (editParam && existingProject) {
        const { updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "projects", editParam), projectData);
        
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Edit Pesanan", `Mengubah data pesanan klien ${clientName} (${editParam})`);
        
        alert("Pesanan berhasil diperbarui!");
        window.location.href = '/dashboard/bookings';
      } else {
        const newProject: Project = {
          ...projectData,
          id,
          createdAt: new Date().toISOString(),
          status: 'Menunggu Pembayaran',
          createdBy: localStorage.getItem('zeey_auth_user') || 'Owner',
        };
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
      setDriveFolderId("");
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

        <div className="bg-surface border border-border p-6 md:p-8 rounded-3xl shadow-sm">
          {isLoadingData ? (
             <div className="flex justify-center items-center h-32">
               <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
             </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <h2 className="text-xl md:text-2xl font-serif mb-6 border-b border-border/50 pb-4">Data Klien</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nama Klien</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g., John & Jane"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">WhatsApp Number</label>
                <input 
                  type="tel" 
                  required
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                  placeholder="e.g., 08123456789"
                />
              </div>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tipe Klien</label>
                <select 
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={clientType}
                  onChange={(e) => setClientType(e.target.value as any)}
                >
                  <option value="Reguler">Reguler</option>
                  <option value="VIP">VIP</option>
                  <option value="Blacklist">Blacklist</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Sumber Klien (Lead Source)</label>
                <select 
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Sumber --</option>
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Referensi Teman">Referensi Teman</option>
                  <option value="Iklan Facebook/IG">Iklan Facebook/IG</option>
                  <option value="Walk-in (Datang Langsung)">Walk-in (Datang Langsung)</option>
                  <option value="Lainnya">Lainnya...</option>
                </select>
                {leadSource === "Lainnya" && (
                  <input 
                    type="text" 
                    required
                    placeholder="Sebutkan sumber klien..."
                    className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all mt-2 animate-in fade-in"
                    value={customLeadSource}
                    onChange={(e) => setCustomLeadSource(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email Klien (Opsional)</label>
                <input 
                  type="email" 
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="e.g., client@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Akun Instagram / TikTok</label>
                <input 
                  type="text" 
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={socialMedia}
                  onChange={(e) => setSocialMedia(e.target.value)}
                  placeholder="e.g., @johndoe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Catatan / Preferensi Khusus</label>
              <textarea 
                className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all min-h-[100px]"
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="e.g., Klien pemalu, konsep vintage, alergi makeup..."
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Link / ID Folder Google Drive (Opsional)</label>
              <input 
                type="text" 
                className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                value={driveFolderId}
                onChange={(e) => setDriveFolderId(e.target.value)}
                placeholder="e.g., https://drive.google.com/drive/folders/... atau 1A2B3C..."
              />
              <p className="text-xs text-foreground/50 mt-1">Masukkan ID folder atau link folder Google Drive tempat foto mentah disimpan (berguna agar foto klien bisa langsung dibaca sistem).</p>
            </div>

            <h2 className="text-xl md:text-2xl font-serif mb-6 border-b border-border/50 pb-4 pt-6">Detail Pesanan</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Paket Harga</label>
                <select 
                  required
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={selectedPackage}
                  onChange={(e) => setSelectedPackage(e.target.value)}
                >
                  <option value="">-- Pilih Paket --</option>
                  {priceList.filter(p => !p.isSystem).map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Rp {p.price.toLocaleString('id-ID')})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Batas Maksimal Pilih Foto</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={maxPhotos}
                  onChange={(e) => setMaxPhotos(Number(e.target.value))}
                  placeholder="e.g., 50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tanggal Pemotretan</label>
                <input 
                  type="date" 
                  required
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={shootDate}
                  onChange={(e) => setShootDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Jam Pemotretan</label>
                <input 
                  type="time" 
                  required
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={shootTime}
                  onChange={(e) => setShootTime(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-2">
              <label className="block text-sm font-medium mb-2">DP / Uang Muka (Rp) (Opsional)</label>
              <input 
                type="number" 
                min="0"
                className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                value={dpAmount}
                onChange={(e) => setDpAmount(Number(e.target.value))}
                placeholder="e.g., 500000"
              />
              <p className="text-xs text-foreground/50 mt-1">Jika klien sudah membayar uang muka (DP), masukkan nominalnya di sini agar terpotong dari total tagihan akhir.</p>
            </div>

            {authRole === "owner" && (
              <div>
                <label className="block text-sm font-medium mb-2">Tugaskan Fotografer (Admin)</label>
                <select 
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  value={assignedAdmin}
                  onChange={(e) => setAssignedAdmin(e.target.value)}
                >
                  <option value="">-- Pilih Fotografer --</option>
                  {adminsList.map(a => (
                    <option key={a.id} value={a.name}>{a.name} ({a.username})</option>
                  ))}
                </select>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                {errorMsg}
              </div>
            )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-accent text-white py-4 rounded-xl font-medium hover:bg-accent-dark transition-all mt-4 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed shadow-md"
            >
              {isSubmitting ? 'Memproses...' : (editParam ? 'Simpan Perubahan' : 'Buat Pesanan & Jadwal')}
            </button>
          </form>
          )}

          {generatedLink && (
            <div className="mt-10 p-6 bg-surface-alt border border-border rounded-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-lg font-serif mb-2">Pesanan Berhasil Dibuat!</h3>
              
              <p className="text-sm text-foreground/70 mb-4">Bagikan tautan unik ini kepada klien Anda untuk memantau status pesanan (dan memilih foto nanti):</p>
              
              <div className="flex items-center gap-2 mb-6">
                <input 
                  type="text" 
                  readOnly 
                  value={generatedLink} 
                  className="w-full p-3.5 bg-background border border-border rounded-xl text-sm text-foreground/80 outline-none focus:border-accent transition-all"
                />
                <button 
                  type="button"
                  onClick={() => navigator.clipboard.writeText(generatedLink)}
                  className="p-3.5 border border-border rounded-xl hover:bg-surface-alt transition-colors whitespace-nowrap text-sm font-medium cursor-pointer"
                >
                  Salin
                </button>
              </div>

              <div className="flex gap-4 flex-col sm:flex-row">
                <a 
                  href={createWhatsAppLink()} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 bg-[#25D366] text-white text-center py-3.5 rounded-xl font-medium hover:bg-[#20bd5a] transition-all shadow-sm"
                >
                  Kirim via WhatsApp
                </a>
                <Link
                  href={new URL(generatedLink).pathname}
                  target="_blank"
                  className="flex-1 bg-foreground text-surface text-center py-3.5 rounded-xl font-medium hover:bg-black transition-all shadow-sm"
                >
                  Pratinjau Klien
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
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
