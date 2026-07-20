"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PortfolioSettings from "@/components/PortfolioSettings";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";

export type PriceItem = {
  id: string;
  name: string;
  price: number;
  unit: string;
  isSystem?: boolean; 
};

const DEFAULT_PRICELIST: PriceItem[] = [
  { id: "extra_photo", name: "Foto Tambahan", price: 50000, unit: "per foto", isSystem: true },
  { id: "editor_request", name: "Jasa Editor (Retouch)", price: 100000, unit: "per request", isSystem: true },
  { id: "print_album", name: "Cetak Album 20 Halaman", price: 500000, unit: "per album" },
  { id: "softcopy_all", name: "Softcopy Seluruh Foto (Google Drive)", price: 1500000, unit: "paket" }
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profil' | 'pembayaran' | 'harga' | 'admin' | 'portofolio' | 'panduan'>('profil');
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("zeey_auth_role");
    if (role !== "owner") {
      router.push("/dashboard");
    }
  }, [router]);
  // --- HARGA STATE ---
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
  const [formData, setFormData] = useState({ name: "", price: "", unit: "" });

  // --- PROFIL STATE ---
  const [profile, setProfile] = useState({ studioName: "Zeey Studio", waNumber: "", logoUrl: "" });
  const [isProfileSaved, setIsProfileSaved] = useState(false);

  // --- PEMBAYARAN STATE ---
  // --- PEMBAYARAN STATE ---
  const [payment, setPayment] = useState({ cashifyApiKey: "", cashifyWebhookSecret: "", qrisString: "", bankName: "", accountNumber: "", accountName: "" });
  const [isPaymentSaved, setIsPaymentSaved] = useState(false);



  // --- ADMIN STATE ---
  const [adminsList, setAdminsList] = useState<Array<any>>([]);
  const [adminForm, setAdminForm] = useState<{ username: string; name: string; password: string; role: string; accesses: string[], commission: string, waNumber: string, specialization: string, bankInfo: string, employmentStatus: string, kpiTarget: string }>({ username: "", name: "", password: "", role: "admin", accesses: ["portfolio", "bookings"], commission: "", waNumber: "", specialization: "Photographer", bankInfo: "", employmentStatus: "Full-time", kpiTarget: "" });
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const loadAdmins = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "admins"));
      const admins = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; username: string; name: string; role?: string; accesses?: string[], commission?: number }));
      setAdminsList(admins);
    } catch (e) {
      console.error("Error loading admins:", e);
    }
  };

  useEffect(() => {
    // Load Prices from Firestore
    const loadPrices = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "pricelist"));
        if (!querySnapshot.empty) {
          const pricesMap = new Map<string, PriceItem>();
          querySnapshot.docs.forEach(d => {
            const data = d.data();
            const itemId = data.id || d.id;
            if (!pricesMap.has(itemId)) {
              pricesMap.set(itemId, { ...data, id: itemId } as PriceItem);
            }
          });
          const prices = Array.from(pricesMap.values());
          // Sort system items first
          prices.sort((a, b) => (a.isSystem === b.isSystem ? 0 : a.isSystem ? -1 : 1));
          setPriceList(prices);
        } else {
          // If empty, initialize with default and save to Firestore
          setPriceList(DEFAULT_PRICELIST);
          for (const item of DEFAULT_PRICELIST) {
            await setDoc(doc(db, "pricelist", item.id), item);
          }
        }
      } catch (e) {
        console.error("Error loading prices:", e);
      }
    };
    loadPrices();

    // Load Profile
    const savedProfile = JSON.parse(localStorage.getItem("zeey_profile") || "null");
    if (savedProfile) setProfile(savedProfile);

    // Load Payment from Firestore
    const loadPayment = async () => {
      try {
        const { getDoc, doc } = await import("firebase/firestore");
        const docSnap = await getDoc(doc(db, "settings", "payment"));
        if (docSnap.exists()) {
          setPayment(docSnap.data() as any);
        }
      } catch (e) {
        console.error("Error loading payment", e);
      }
    };
    loadPayment();



    // Load Admins
    loadAdmins();
  }, []);


  // --- HARGA HANDLERS ---
  const loadPricesFromDb = async () => {
    const querySnapshot = await getDocs(collection(db, "pricelist"));
    const pricesMap = new Map<string, PriceItem>();
    querySnapshot.docs.forEach(d => {
      const data = d.data();
      const itemId = data.id || d.id;
      if (!pricesMap.has(itemId)) {
        pricesMap.set(itemId, { ...data, id: itemId } as PriceItem);
      }
    });
    const prices = Array.from(pricesMap.values());
    prices.sort((a, b) => (a.isSystem === b.isSystem ? 0 : a.isSystem ? -1 : 1));
    setPriceList(prices);
  };

  const handleOpenModal = (item?: PriceItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({ name: item.name, price: item.price.toString(), unit: item.unit });
    } else {
      setEditingItem(null);
      setFormData({ name: "", price: "", unit: "" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceValue = parseInt(formData.price.toString().replace(/[^0-9]/g, "")) || 0;
    
    try {
      if (editingItem) {
        // Update in Firestore. We need the document id.
        await setDoc(doc(db, "pricelist", editingItem.id), {
          name: formData.name,
          price: priceValue,
          unit: formData.unit,
          isSystem: editingItem.isSystem || false
        }, { merge: true });
      } else {
        await addDoc(collection(db, "pricelist"), {
          name: formData.name,
          price: priceValue,
          unit: formData.unit,
          isSystem: false
        });
      }
      
      const { logActivity } = await import("@/lib/audit");
      await logActivity("Harga", editingItem ? `Mengubah harga ${formData.name}` : `Menambahkan harga baru ${formData.name}`);

      await loadPricesFromDb();
      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan harga.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus item ini?")) {
      try {
        const item = priceList.find(p => p.id === id);
        await deleteDoc(doc(db, "pricelist", id));
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Harga", `Menghapus item harga ${item?.name}`);
        await loadPricesFromDb();
      } catch (err) {
        console.error(err);
        alert("Gagal menghapus item.");
      }
    }
  };

  // --- PROFIL HANDLERS ---
  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("zeey_profile", JSON.stringify(profile));
    setIsProfileSaved(true);
    setTimeout(() => setIsProfileSaved(false), 3000);
  };

  // --- PEMBAYARAN HANDLERS ---
  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { setDoc, doc } = await import("firebase/firestore");
      await setDoc(doc(db, "settings", "payment"), payment);
      setIsPaymentSaved(true);
      setTimeout(() => setIsPaymentSaved(false), 3000);
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan pengaturan pembayaran");
    }
  };


  // --- ADMIN HANDLERS ---
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdminLoading(true);
    
    const adminPayload = {
      username: adminForm.username,
      name: adminForm.name,
      role: "admin",
      accesses: adminForm.accesses,
      commission: parseInt(adminForm.commission.toString().replace(/[^0-9]/g, "")) || 0,
      waNumber: adminForm.waNumber,
      specialization: adminForm.specialization,
      bankInfo: adminForm.bankInfo,
      employmentStatus: adminForm.employmentStatus,
      kpiTarget: parseInt(adminForm.kpiTarget.toString().replace(/[^0-9]/g, "")) || 0
    };

    try {
      if (editingAdminId) {
        const updateData: any = { ...adminPayload };
        if (adminForm.password.trim() !== "") {
          updateData.password = adminForm.password;
        }
        await updateDoc(doc(db, "admins", editingAdminId), updateData);
      } else {
        await addDoc(collection(db, "admins"), {
          ...adminPayload,
          password: adminForm.password,
          createdAt: new Date().toISOString()
        });
      }
      
      const { logActivity } = await import("@/lib/audit");
      await logActivity("Admin", editingAdminId ? `Mengubah data admin ${adminForm.username}` : `Menambahkan admin baru ${adminForm.username}`);

      setAdminForm({ username: "", name: "", password: "", role: "admin", accesses: ["portfolio", "bookings"], commission: "", waNumber: "", specialization: "Photographer", bankInfo: "", employmentStatus: "Full-time", kpiTarget: "" });
      setEditingAdminId(null);
      loadAdmins();
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan data admin");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleEditAdmin = (admin: any) => {
    setAdminForm({
      username: admin.username,
      name: admin.name,
      password: "", 
      role: "admin",
      accesses: admin.accesses || (admin.role === "admin_editor" ? ["editor", "portfolio"] : ["bookings", "portfolio"]),
      commission: admin.commission ? admin.commission.toString() : "",
      waNumber: admin.waNumber || "",
      specialization: admin.specialization || "Photographer",
      bankInfo: admin.bankInfo || "",
      employmentStatus: admin.employmentStatus || "Full-time",
      kpiTarget: admin.kpiTarget ? admin.kpiTarget.toString() : ""
    });
    setEditingAdminId(admin.id);
    
    // Scroll to form (optional UX)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditAdmin = () => {
    setAdminForm({ username: "", name: "", password: "", role: "admin", accesses: ["portfolio", "bookings"], commission: "", waNumber: "", specialization: "Photographer", bankInfo: "", employmentStatus: "Full-time", kpiTarget: "" });
    setEditingAdminId(null);
  };

  const handleDeleteAdmin = async (id: string) => {
    if (confirm("Hapus admin ini?")) {
      try {
        const admin = adminsList.find(a => a.id === id);
        await deleteDoc(doc(db, "admins", id));
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Admin", `Menghapus admin ${admin?.username}`);
        loadAdmins();
      } catch (err) {
        console.error(err);
        alert("Gagal menghapus admin");
      }
    }
  };

  return (
    <Sidebar>
      <div className="p-4 md:p-8 lg:p-10 max-w-5xl mx-auto w-full animate-in fade-in duration-500 pb-24">
        <div className="mb-8 border-b border-border/50 pb-6">
          <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Pengaturan Dashboard</h1>
          <p className="text-foreground/70 font-sans text-sm md:text-base">Kelola profil studio, integrasi pembayaran, dan daftar harga.</p>
        </div>

        {/* Custom Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-border/50 pb-1 font-sans overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab('profil')} 
            className={`px-5 md:px-6 py-3 font-medium text-sm rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'profil' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Profil Studio
          </button>
          <button 
            onClick={() => setActiveTab('pembayaran')} 
            className={`px-5 md:px-6 py-3 font-medium text-sm rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'pembayaran' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Metode Pembayaran
          </button>
          <button 
            onClick={() => setActiveTab('harga')} 
            className={`px-5 md:px-6 py-3 font-medium text-sm rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'harga' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Daftar Harga
          </button>
          <button 
            onClick={() => setActiveTab('admin')} 
            className={`px-5 md:px-6 py-3 font-medium text-sm rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'admin' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Akun Admin
          </button>
          <button 
            onClick={() => setActiveTab('portofolio')} 
            className={`px-5 md:px-6 py-3 font-medium text-sm rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'portofolio' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Galeri Portofolio
          </button>
          <button 
            onClick={() => setActiveTab('panduan')} 
            className={`px-5 md:px-6 py-3 font-medium text-sm rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'panduan' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Panduan & Bantuan
          </button>

        </div>

        {/* Tab Content: Portofolio */}
        {activeTab === 'portofolio' && (
          <PortfolioSettings />
        )}

        {/* Tab Content: Panduan */}
        {activeTab === 'panduan' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-surface border border-border rounded-3xl shadow-sm p-6 md:p-8">
              <h2 className="text-2xl font-serif mb-6 border-b border-border/50 pb-4">Panduan Penggunaan Google Drive</h2>
              
              <div className="space-y-8 font-sans">
                {/* Langkah 1 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold">1</div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Buat Folder di Google Drive</h3>
                    <p className="text-foreground/70 mb-3 text-sm leading-relaxed">
                      Buka Google Drive Anda, lalu buat folder baru khusus untuk klien tersebut (misalnya: <strong>"Foto Wedding Budi & Ani"</strong>). Upload semua foto ke dalam folder tersebut.
                    </p>
                  </div>
                </div>

                {/* Langkah 2 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Ubah Akses Link (Share)</h3>
                    <p className="text-foreground/70 mb-3 text-sm leading-relaxed">
                      Klik kanan pada folder yang baru dibuat, lalu pilih <strong>Bagikan (Share)</strong>. Di bagian "Akses umum" (General access), ubah pilihan "Dibatasi" (Restricted) menjadi <strong>"Siapa saja yang memiliki link" (Anyone with the link)</strong>.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-xs">
                      <strong>⚠️ PENTING:</strong> Jika langkah ini dilewati, klien tidak akan bisa membuka link foto yang Anda berikan.
                    </div>
                  </div>
                </div>

                {/* Langkah 3 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold">3</div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Salin (Copy) Link Folder</h3>
                    <p className="text-foreground/70 mb-3 text-sm leading-relaxed">
                      Setelah akses diubah, klik tombol <strong>"Salin link" (Copy link)</strong> pada jendela yang sama, lalu klik "Selesai".
                    </p>
                  </div>
                </div>

                {/* Langkah 4 */}
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold">4</div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-2">Masukkan Link ke Dashboard Zeey Studio</h3>
                    <p className="text-foreground/70 mb-3 text-sm leading-relaxed">
                      Kembali ke dashboard Zeey Studio Anda. Link yang disalin tadi dapat Anda masukkan pada dua tempat berikut:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-foreground/70 ml-2">
                      <li><strong>Di halaman "Daftar Pesanan" (Bookings):</strong> Klik tombol <em>"Upload GDrive & Selesai Foto"</em> pada pesanan klien, lalu *paste* (tempel) link di sana.</li>
                      <li><strong>Di halaman "Tugas Editor" (Editor):</strong> Tempel (paste) link ke kolom <em>"Link Foto Editan (Google Drive)"</em> untuk mengirim foto hasil edit ke klien.</li>
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Profil */}
        {activeTab === 'profil' && (
          <div className="bg-surface border border-border rounded-3xl shadow-sm p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-xl md:text-2xl font-serif mb-6 border-b border-border/50 pb-4">Informasi Studio</h2>
            <form onSubmit={saveProfile} className="space-y-6 max-w-xl font-sans">
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground/80">Nama Studio</label>
                <input 
                  type="text" 
                  value={profile.studioName}
                  onChange={(e) => setProfile({...profile, studioName: e.target.value})}
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  placeholder="Contoh: Zeey Studio"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground/80">Nomor WhatsApp Admin</label>
                <input 
                  type="text" 
                  value={profile.waNumber}
                  onChange={(e) => setProfile({...profile, waNumber: e.target.value})}
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  placeholder="Contoh: 628123456789"
                />
                <p className="text-xs text-foreground/50 mt-2">Nomor ini akan digunakan sebagai tujuan kontak dari klien.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground/80">URL Logo Studio (Opsional)</label>
                <input 
                  type="text" 
                  value={profile.logoUrl}
                  onChange={(e) => setProfile({...profile, logoUrl: e.target.value})}
                  className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  placeholder="https://..."
                />
              </div>
              
              <div className="pt-4 flex items-center gap-4">
                <button type="submit" className="bg-accent text-white px-8 py-3.5 rounded-xl font-medium hover:bg-accent-dark transition-all shadow-md cursor-pointer w-full md:w-auto">
                  Simpan Profil
                </button>
                {isProfileSaved && <span className="text-green-600 text-sm flex items-center gap-1 animate-in fade-in"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Tersimpan!</span>}
              </div>
            </form>
          </div>
        )}

        {/* Tab Content: Pembayaran */}
        {activeTab === 'pembayaran' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-surface border border-border rounded-3xl shadow-sm p-6 md:p-8">
              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                <div className="bg-accent/10 p-3 rounded-xl text-accent">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-serif mb-1">Integrasi Cashify (QRIS Dinamis)</h2>
                  <p className="text-foreground/60 font-sans text-sm">Hubungkan API Cashify Anda untuk memproses QRIS secara otomatis.</p>
                </div>
              </div>
              
              <form onSubmit={savePayment} className="space-y-6 max-w-xl font-sans">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/80">Cashify API Key</label>
                  <input 
                    type="password" 
                    value={payment.cashifyApiKey}
                    onChange={(e) => setPayment({...payment, cashifyApiKey: e.target.value})}
                    className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                    placeholder="cashify_..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/80">Cashify Webhook Secret</label>
                  <input 
                    type="password" 
                    value={payment.cashifyWebhookSecret}
                    onChange={(e) => setPayment({...payment, cashifyWebhookSecret: e.target.value})}
                    className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                    placeholder="cashify_..."
                  />
                  <p className="text-xs text-foreground/50 mt-2">Gunakan URL Webhook: <code className="bg-surface-alt px-1 py-0.5 rounded border border-border">https://domainanda.com/api/webhook/cashify</code></p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/80">QRIS Statis (String Lengkap)</label>
                  <textarea 
                    value={payment.qrisString}
                    onChange={(e) => setPayment({...payment, qrisString: e.target.value})}
                    className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono text-xs h-32"
                    placeholder="000201010211..."
                  />
                  <p className="text-xs text-foreground/50 mt-2">Dapatkan string QRIS statis dari barcode toko/studio Anda.</p>
                </div>
                
                <h3 className="text-lg font-serif pt-6 border-t border-border text-foreground">Metode Transfer Manual (Alternatif)</h3>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/80">Nama Bank / E-Wallet</label>
                  <input 
                    type="text" 
                    value={payment.bankName}
                    onChange={(e) => setPayment({...payment, bankName: e.target.value})}
                    className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                    placeholder="Contoh: BCA"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Nomor Rekening</label>
                    <input 
                      type="text" 
                      value={payment.accountNumber}
                      onChange={(e) => setPayment({...payment, accountNumber: e.target.value})}
                      className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                      placeholder="1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Atas Nama</label>
                    <input 
                      type="text" 
                      value={payment.accountName}
                      onChange={(e) => setPayment({...payment, accountName: e.target.value})}
                      className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                      placeholder="Zeey Studio"
                    />
                  </div>
                </div>
                
                <div className="pt-4 flex items-center gap-4">
                  <button type="submit" className="bg-accent text-white px-8 py-3.5 rounded-xl font-medium hover:bg-accent-dark transition-all shadow-md cursor-pointer w-full md:w-auto">
                    Simpan Pengaturan
                  </button>
                  {isPaymentSaved && <span className="text-green-600 text-sm flex items-center gap-1 animate-in fade-in"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> Tersimpan!</span>}
                </div>
              </form>
            </div>
          </div>
        )}



        {/* Tab Content: Harga */}
        {activeTab === 'harga' && (
          <div className="bg-surface border border-border rounded-3xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="p-5 md:p-6 border-b border-border bg-surface-alt/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-serif">Daftar Harga (Price List)</h2>
                <p className="text-sm text-foreground/60 mt-1">Daftar ini ditampilkan kepada klien di Galeri.</p>
              </div>
              <button 
                onClick={() => handleOpenModal()}
                className="bg-accent text-white px-5 py-2.5 rounded-xl font-medium hover:bg-accent-dark transition-all shadow-md text-sm cursor-pointer whitespace-nowrap w-full md:w-auto text-center"
              >
                + Tambah Item
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans min-w-[600px]">
                <thead className="bg-surface-alt/50 text-sm text-foreground/70 border-b border-border">
                  <tr>
                    <th className="p-4 font-medium">Nama Layanan / Item</th>
                    <th className="p-4 font-medium">Harga</th>
                    <th className="p-4 font-medium">Satuan</th>
                    <th className="p-4 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {priceList.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-alt/20 transition-colors">
                      <td className="p-4 font-medium">
                        {item.name}
                        {item.isSystem && <span className="ml-2 text-xs bg-accent/10 text-accent px-2 py-1 rounded border border-accent/20">Wajib (Sistem)</span>}
                      </td>
                      <td className="p-4 text-foreground/80 font-medium">
                        Rp {item.price.toLocaleString("id-ID")}
                      </td>
                      <td className="p-4 text-foreground/60 text-sm">
                        {item.unit}
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleOpenModal(item)} className="text-sm text-accent hover:text-accent-dark mr-4 cursor-pointer font-medium">Edit</button>
                        {!item.isSystem ? (
                          <button onClick={() => handleDelete(item.id)} className="text-sm text-foreground/50 hover:text-red-600 cursor-pointer font-medium">Hapus</button>
                        ) : (
                          <span className="text-sm text-foreground/30 cursor-not-allowed inline-block w-[42px] text-center">Hapus</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {priceList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-foreground/50 font-sans">Belum ada daftar harga.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Admin */}
        {activeTab === 'admin' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-surface border border-border rounded-3xl shadow-sm overflow-hidden">
              <div className="p-5 md:p-6 border-b border-border bg-surface-alt/30">
                <h2 className="text-xl font-serif">Daftar Akun Admin</h2>
                <p className="text-sm text-foreground/60 mt-1">Kelola akses portal admin untuk tim Anda.</p>
              </div>
              
              <div className="p-5 md:p-6">
                <form onSubmit={handleAdminSubmit} className="mb-8 p-5 md:p-6 bg-background rounded-2xl border border-border shadow-sm">
                  <h3 className="font-medium mb-4">{editingAdminId ? "Edit Admin" : "Tambah Admin Baru"}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Username Login</label>
                      <input type="text" required placeholder="Username" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.username} onChange={e => setAdminForm({...adminForm, username: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Nama Lengkap</label>
                      <input type="text" required placeholder="Nama Lengkap" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.name} onChange={e => setAdminForm({...adminForm, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Password</label>
                      <input type="password" required={!editingAdminId} placeholder={editingAdminId ? "Kosongkan jika tidak diubah" : "Password"} className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">No. WhatsApp</label>
                      <input type="tel" required placeholder="08123456789" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.waNumber} onChange={e => setAdminForm({...adminForm, waNumber: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Posisi / Spesialisasi</label>
                      <select className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.specialization} onChange={e => setAdminForm({...adminForm, specialization: e.target.value})}>
                        <option value="Photographer">Photographer</option>
                        <option value="Videographer">Videographer</option>
                        <option value="Editor">Editor</option>
                        <option value="Frontdesk/Sales">Frontdesk / Sales</option>
                        <option value="Makeup Artist (MUA)">Makeup Artist (MUA)</option>
                        <option value="Owner">Owner</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Status Pekerjaan</label>
                      <select className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.employmentStatus} onChange={e => setAdminForm({...adminForm, employmentStatus: e.target.value})}>
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Freelance">Freelance</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Informasi Rekening Bank</label>
                      <input type="text" placeholder="BCA - 12345678 a/n Budi" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.bankInfo} onChange={e => setAdminForm({...adminForm, bankInfo: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Komisi per Proyek (Opsional)</label>
                      <input type="text" placeholder="Misal: 100000" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.commission} onChange={e => setAdminForm({...adminForm, commission: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Target Bulanan (KPI / Sales Target)</label>
                      <input type="text" placeholder="Misal: 20" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.kpiTarget} onChange={e => setAdminForm({...adminForm, kpiTarget: e.target.value})} />
                    </div>
                  </div>
                  
                  <div className="mt-5 mb-2">
                    <label className="block text-sm font-medium mb-3 text-foreground/80">Hak Akses Modul:</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { id: 'create', label: 'Buat Booking Baru' },
                        { id: 'editor', label: 'Tugas Editor' },
                        { id: 'bookings', label: 'Daftar Pesanan' },
                        { id: 'portfolio', label: 'Galeri Portofolio' },
                        { id: 'crm', label: 'Data Klien (CRM)' }
                      ].map(module => (
                        <label key={module.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input 
                            type="checkbox" 
                            checked={adminForm.accesses.includes(module.id)}
                            onChange={(e) => {
                              const newAccesses = e.target.checked 
                                ? [...adminForm.accesses, module.id]
                                : adminForm.accesses.filter(a => a !== module.id);
                              setAdminForm({...adminForm, accesses: newAccesses});
                            }}
                            className="w-4 h-4 rounded border-border text-accent focus:ring-accent accent-accent"
                          />
                          <span className="text-foreground/80">{module.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    {editingAdminId && (
                      <button type="button" onClick={cancelEditAdmin} className="w-full md:w-auto px-8 py-3.5 rounded-xl font-medium border border-border hover:bg-surface-alt transition-all cursor-pointer">
                        Batal
                      </button>
                    )}
                    <button type="submit" disabled={isAdminLoading} className="flex-1 md:flex-none w-full md:w-auto bg-accent text-white px-8 py-3.5 rounded-xl font-medium hover:bg-accent-dark transition-all cursor-pointer disabled:opacity-70 shadow-sm">
                      {isAdminLoading ? "Menyimpan..." : (editingAdminId ? "Simpan Perubahan" : "Tambah Admin")}
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans">
                    <thead className="bg-surface-alt/50 text-sm text-foreground/70">
                      <tr>
                        <th className="p-4 font-medium">Username</th>
                        <th className="p-4 font-medium">Nama</th>
                        <th className="p-4 font-medium">Hak Akses</th>
                        <th className="p-4 font-medium text-center">Komisi</th>
                        <th className="p-4 font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {adminsList.map((adm) => (
                        <tr key={adm.id} className="hover:bg-surface-alt/10">
                          <td className="p-4">
                            <span className="font-medium text-foreground">{adm.username}</span>
                          </td>
                          <td className="p-4 text-foreground/80">{adm.name}</td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {adm.accesses?.map((acc: string) => (
                                <span key={acc} className="px-2 py-0.5 bg-accent/10 text-accent rounded text-[10px] uppercase font-bold tracking-wider">
                                  {acc}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            {adm.commission && adm.commission > 0 ? (
                              <span className="text-green-600 font-medium whitespace-nowrap">Rp {adm.commission.toLocaleString("id-ID")}</span>
                            ) : (
                              <span className="text-foreground/40">-</span>
                            )}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <button onClick={() => handleEditAdmin(adm)} className="text-sm text-accent hover:text-accent-dark mr-3 cursor-pointer font-medium">Edit</button>
                            <button onClick={() => handleDeleteAdmin(adm.id)} className="text-sm text-red-600 hover:text-red-800 cursor-pointer font-medium">Hapus</button>
                          </td>
                        </tr>
                      ))}
                      {adminsList.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-foreground/50">Belum ada akun admin.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Item Modal (Harga) */}
      {isModalOpen && activeTab === 'harga' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-serif mb-6">{editingItem ? "Edit Harga" : "Tambah Harga Baru"}</h2>
              <form onSubmit={handlePriceSubmit} className="space-y-5 font-sans">
                <div>
                  <label className="block text-sm font-medium mb-2">Nama Layanan</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3.5 border border-border rounded-xl focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent bg-background transition-all"
                    placeholder="e.g., Cetak Kanvas 40x60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Harga (Rp)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                    className="w-full p-3 border border-border rounded-lg focus:outline-none focus:border-accent bg-background"
                    placeholder="e.g., 250000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Satuan</label>
                  <input 
                    type="text" 
                    required
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                    className="w-full p-3 border border-border rounded-lg focus:outline-none focus:border-accent bg-background"
                    placeholder="e.g., per bingkai"
                  />
                </div>
                
                <div className="flex gap-4 pt-4 mt-6 border-t border-border">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-3.5 border border-border rounded-xl hover:bg-surface-alt transition-colors cursor-pointer font-medium"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3.5 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors cursor-pointer font-medium shadow-md"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
