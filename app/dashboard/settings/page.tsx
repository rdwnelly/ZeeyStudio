"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc } from "firebase/firestore";

export type PriceItem = {
  id: string;
  name: string;
  price: number;
  unit: string;
  isSystem?: boolean;
  scheme?: 'berbayar' | 'sudah bayar';
};

const DEFAULT_PRICELIST: PriceItem[] = [
  { id: "extra_photo", name: "Foto Tambahan", price: 50000, unit: "per foto", isSystem: true },
  { id: "editor_request", name: "Jasa Editor (Retouch)", price: 100000, unit: "per request", isSystem: true },
  { id: "print_album", name: "Cetak Album 20 Halaman", price: 500000, unit: "per album" },
  { id: "softcopy_all", name: "Softcopy Seluruh Foto (Google Drive)", price: 1500000, unit: "paket" }
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profil' | 'pembayaran' | 'harga' | 'admin' | 'panduan' | 'lanjutan'>('profil');
  const router = useRouter();

  // --- LANJUTAN / RESET DATA STATE ---
  const [isResettingExpenses, setIsResettingExpenses] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [isResettingAnalytics, setIsResettingAnalytics] = useState(false);

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
  const [formData, setFormData] = useState({ name: "", price: "", unit: "", scheme: "berbayar" });

  // --- PROFIL STATE ---
  const [profile, setProfile] = useState({
    studioName: "Zeey Studio",
    waNumber: "",
    logoUrl: "",
    address: "",
    email: "",
    instagram: "",
    tiktok: "",
    openHours: "",
    termsConditions: "",
    tagline: "",
    brandColor: "#6366f1",
    welcomeMessage: ""
  });
  const [isProfileSaved, setIsProfileSaved] = useState(false);

  // --- PEMBAYARAN STATE ---
  const [payment, setPayment] = useState({
    // Casaku.id (primary payment integration)
    casaku_license_key: "",
    casaku_webhook_secret: "",
    casaku_qr_id: "",
    // Legacy Cashify (fallback)
    cashifyApiKey: "",
    cashifyWebhookSecret: "",
    qrisString: "",
    // Transfer Manual
    bankName: "",
    accountNumber: "",
    accountName: "",
  });
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
      
      // Auto-fix bug: accidentally flagged as system in DB
      if ((itemId === "print_album" || itemId === "softcopy_all") && data.isSystem) {
        data.isSystem = false;
        updateDoc(doc(db, "pricelist", d.id), { isSystem: false }); // Update DB di background
      }

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
      setFormData({ name: item.name, price: item.price.toString(), unit: item.unit, scheme: item.scheme || "berbayar" });
    } else {
      setEditingItem(null);
      setFormData({ name: "", price: "", unit: "", scheme: "berbayar" });
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
          scheme: formData.scheme,
          isSystem: editingItem.isSystem || false
        }, { merge: true });
      } else {
        await addDoc(collection(db, "pricelist"), {
          name: formData.name,
          price: priceValue,
          unit: formData.unit,
          scheme: formData.scheme,
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


  // --- LANJUTAN HANDLERS ---
  const handleResetFinanceData = async (type: 'expenses' | 'all') => {
    const message = type === 'expenses'
      ? "Ketik 'RESET' untuk menghapus seluruh data PENGELUARAN."
      : "PERINGATAN KERAS: Ketik 'RESET SEMUA' untuk menghapus seluruh data PENGELUARAN dan PESANAN (Proyek). Seluruh data proyek dan klien akan hilang!";

    const confirmText = prompt(message);
    const expectedText = type === 'expenses' ? 'RESET' : 'RESET SEMUA';

    if (confirmText === expectedText) {
      if (type === 'expenses') setIsResettingExpenses(true);
      else setIsResettingAll(true);

      try {
        const expensesSnap = await getDocs(collection(db, "expenses"));
        const expensePromises = expensesSnap.docs.map(d => deleteDoc(doc(db, "expenses", d.id)));
        await Promise.all(expensePromises);

        if (type === 'all') {
          const projectsSnap = await getDocs(collection(db, "projects"));
          const projectPromises = projectsSnap.docs.map(d => deleteDoc(doc(db, "projects", d.id)));
          await Promise.all(projectPromises);
        }

        const { logActivity } = await import("@/lib/audit");
        await logActivity("Keuangan", type === 'expenses' ? "Mereset data pengeluaran" : "Mereset seluruh data keuangan dan pesanan");

        alert("Data berhasil direset.");
      } catch (err) {
        console.error(err);
        alert("Gagal mereset data.");
      } finally {
        setIsResettingExpenses(false);
        setIsResettingAll(false);
      }
    } else if (confirmText !== null) {
      alert("Konfirmasi tidak sesuai. Dibatalkan.");
    }
  };

  const handleResetAnalyticsData = async () => {
    const confirmText = prompt("PERINGATAN: Ketik 'RESET ANALITIK' untuk menghapus seluruh data proyek dan pesanan yang tampil di Dasbor Analitik.");

    if (confirmText === 'RESET ANALITIK') {
      setIsResettingAnalytics(true);
      try {
        const projectsSnap = await getDocs(collection(db, "projects"));
        const projectPromises = projectsSnap.docs.map(d => deleteDoc(doc(db, "projects", d.id)));
        await Promise.all(projectPromises);

        const { logActivity } = await import("@/lib/audit");
        await logActivity("Sistem", "Mereset data Dasbor Analitik (menghapus semua proyek/pesanan)");

        alert("Data analitik berhasil direset.");
      } catch (err) {
        console.error(err);
        alert("Gagal mereset data analitik.");
      } finally {
        setIsResettingAnalytics(false);
      }
    } else if (confirmText !== null) {
      alert("Konfirmasi tidak sesuai. Dibatalkan.");
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
            onClick={() => setActiveTab('panduan')}
            className={`px-5 md:px-6 py-3 font-medium text-sm rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'panduan' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Panduan & Bantuan
          </button>
          <button
            onClick={() => setActiveTab('lanjutan')}
            className={`px-5 md:px-6 py-3 font-medium text-sm rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === 'lanjutan' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Lanjutan (Sistem)
          </button>

        </div>



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

        {/* Tab Content: Lanjutan */}
        {activeTab === 'lanjutan' && (
          <div className="bg-surface border border-border rounded-3xl shadow-sm p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-xl md:text-2xl font-serif mb-6 border-b border-border/50 pb-4 text-red-600 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Pengaturan Lanjutan (Zona Berbahaya)
            </h2>
            <div className="space-y-6 max-w-xl font-sans">
              <div className="border border-red-200 bg-red-50/30 p-5 md:p-6 rounded-2xl">
                <h3 className="text-lg font-medium text-red-800 mb-2">Reset Data Keuangan & Bisnis</h3>
                <p className="text-sm text-red-600/80 mb-6 leading-relaxed">
                  Fitur ini digunakan untuk menghapus permanen data pada halaman <strong>Keuangan & Bisnis</strong>.
                  Silakan pilih jenis data yang ingin direset.
                  <br /><br />
                  <strong>Peringatan:</strong> Data yang sudah dihapus tidak dapat dikembalikan.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleResetFinanceData('expenses')}
                    disabled={isResettingExpenses || isResettingAll}
                    className="bg-red-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-red-700 transition-all cursor-pointer shadow-sm text-sm disabled:opacity-70 flex items-center justify-center gap-2 w-full md:w-auto"
                  >
                    {isResettingExpenses ? "Menghapus..." : "Reset Hanya Data Pengeluaran"}
                  </button>
                  <button
                    onClick={() => handleResetFinanceData('all')}
                    disabled={isResettingExpenses || isResettingAll}
                    className="bg-transparent border border-red-600 text-red-700 px-5 py-3 rounded-xl font-medium hover:bg-red-50 transition-all cursor-pointer shadow-sm text-sm disabled:opacity-70 flex items-center justify-center gap-2 w-full md:w-auto mt-2"
                  >
                    {isResettingAll ? "Menghapus..." : "Reset Semua (Pengeluaran & Data Pesanan/Proyek)"}
                  </button>
                </div>
              </div>

              <div className="border border-red-200 bg-red-50/30 p-5 md:p-6 rounded-2xl">
                <h3 className="text-lg font-medium text-red-800 mb-2">Reset Dasbor Analitik (Ringkasan Studio)</h3>
                <p className="text-sm text-red-600/80 mb-6 leading-relaxed">
                  Fitur ini akan mereset data metrik kinerja pada Dasbor Utama (Ringkasan Studio).
                  Ini berarti <strong>seluruh data Pesanan/Proyek klien akan dihapus</strong> dari sistem untuk memulai grafik dari angka 0.
                </p>
                <button
                  onClick={handleResetAnalyticsData}
                  disabled={isResettingAnalytics}
                  className="bg-red-600 text-white px-5 py-3 rounded-xl font-medium hover:bg-red-700 transition-all cursor-pointer shadow-sm text-sm disabled:opacity-70 flex items-center justify-center gap-2 w-full md:w-auto"
                >
                  {isResettingAnalytics ? "Menghapus..." : "Reset Data Dasbor Analitik"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Profil */}
        {activeTab === 'profil' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-surface border border-border rounded-3xl shadow-sm overflow-hidden">
              <div className="p-5 md:p-8 border-b border-border bg-surface-alt/30">
                <h2 className="text-xl md:text-2xl font-serif text-foreground">Informasi Studio</h2>
                <p className="text-sm text-foreground/60 mt-1">Atur profil dasar, kontak, dan operasional studio Anda.</p>
              </div>

              <form onSubmit={saveProfile} className="p-5 md:p-8 space-y-10 font-sans">
                {/* Section: Informasi Utama */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="md:col-span-2 border-b border-border/50 pb-2 mb-2">
                    <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                      <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                      Informasi Utama
                    </h3>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">Nama Studio</label>
                    <input
                      type="text"
                      value={profile.studioName || ""}
                      onChange={(e) => setProfile({ ...profile, studioName: e.target.value })}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm"
                      placeholder="Contoh: Zeey Studio"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">Nomor WhatsApp Admin</label>
                    <input
                      type="text"
                      value={profile.waNumber || ""}
                      onChange={(e) => setProfile({ ...profile, waNumber: e.target.value })}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm"
                      placeholder="Contoh: 628123456789"
                    />
                    <p className="text-xs text-foreground/50 mt-2 ml-1">Nomor ini akan digunakan sebagai tujuan kontak dari klien.</p>
                  </div>
                </div>

                {/* Section: Kontak & Lokasi */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="md:col-span-2 border-b border-border/50 pb-2 mb-2">
                    <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                      <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      Kontak & Lokasi
                    </h3>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">Alamat Lengkap / Lokasi (Gmaps)</label>
                    <textarea
                      value={profile.address || ""}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm min-h-[100px]"
                      placeholder="Contoh: Jl. Sudirman No. 123, Jakarta"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">Email Resmi</label>
                    <input
                      type="email"
                      value={profile.email || ""}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm"
                      placeholder="Contoh: hello@zeeystudio.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">Instagram (Username)</label>
                    <input
                      type="text"
                      value={profile.instagram || ""}
                      onChange={(e) => setProfile({ ...profile, instagram: e.target.value })}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm"
                      placeholder="Contoh: @zeeystudio"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">TikTok (Username)</label>
                    <input
                      type="text"
                      value={profile.tiktok || ""}
                      onChange={(e) => setProfile({ ...profile, tiktok: e.target.value })}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm"
                      placeholder="Contoh: @zeeystudio"
                    />
                  </div>
                </div>

                {/* Section: Operasional & Branding */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="md:col-span-2 border-b border-border/50 pb-2 mb-2">
                    <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                      <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      Operasional & Branding
                    </h3>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">Jam Operasional</label>
                    <input
                      type="text"
                      value={profile.openHours || ""}
                      onChange={(e) => setProfile({ ...profile, openHours: e.target.value })}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm"
                      placeholder="Contoh: Senin - Sabtu (09.00 - 17.00 WIB)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">Deskripsi Singkat / Slogan</label>
                    <input
                      type="text"
                      value={profile.tagline || ""}
                      onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm"
                      placeholder="Contoh: Mengabadikan Momen Bahagia Anda"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">Kebijakan & Syarat Ketentuan (S&K)</label>
                    <textarea
                      value={profile.termsConditions || ""}
                      onChange={(e) => setProfile({ ...profile, termsConditions: e.target.value })}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm min-h-[120px]"
                      placeholder="Contoh: DP tidak dapat dikembalikan jika terjadi pembatalan sepihak..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">Pesan Sambutan Klien (Kustom)</label>
                    <textarea
                      value={profile.welcomeMessage || ""}
                      onChange={(e) => setProfile({ ...profile, welcomeMessage: e.target.value })}
                      className="w-full p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all shadow-sm min-h-[100px]"
                      placeholder="Contoh: Halo! Terima kasih telah mempercayakan momen spesial Anda kepada Zeey Studio..."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2 text-foreground/80 ml-1">Warna Tema Utama (Brand Color)</label>
                    <div className="flex gap-4 items-center">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-sm border border-border">
                        <input
                          type="color"
                          value={profile.brandColor || "#6366f1"}
                          onChange={(e) => setProfile({ ...profile, brandColor: e.target.value })}
                          className="absolute inset-[-20%] w-[140%] h-[140%] cursor-pointer border-0 p-0 m-0"
                        />
                      </div>
                      <input
                        type="text"
                        value={profile.brandColor || "#6366f1"}
                        onChange={(e) => setProfile({ ...profile, brandColor: e.target.value })}
                        className="w-full max-w-[150px] p-4 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all uppercase shadow-sm font-mono text-center"
                        placeholder="#6366F1"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-10 border-t border-border/50 flex flex-col md:flex-row items-center gap-4 bg-surface-alt/20 -mx-5 -mb-5 md:-mx-8 md:-mb-8 p-5 md:p-8">
                  <button type="submit" className="w-full md:w-auto bg-accent text-white px-10 py-4 rounded-xl font-bold hover:bg-accent-dark transition-all shadow-md cursor-pointer text-lg">
                    Simpan Profil Studio
                  </button>
                  {isProfileSaved && (
                    <span className="text-green-600 font-medium flex items-center gap-2 animate-in fade-in bg-green-50 px-4 py-2 rounded-lg border border-green-100">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> 
                      Perubahan Berhasil Disimpan!
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab Content: Pembayaran */}
        {activeTab === 'pembayaran' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">

            {/* ── Casaku.id Integration Card ─────────────────────────────────── */}
            <div className="bg-surface border border-border rounded-3xl shadow-sm p-6 md:p-8">
              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6M9 11h3" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-serif">Integrasi Casaku.id</h2>
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 text-xs font-bold px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      Direkomendasikan
                    </span>
                  </div>
                  <p className="text-foreground/60 font-sans text-sm">
                    Casaku membaca notifikasi saldo masuk di HP Android Anda, lalu memverifikasi pesanan secara otomatis — tanpa payment gateway, tanpa potongan pajak.
                  </p>
                </div>
              </div>

              {/* Cara Setup */}
              <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl p-5 mb-6 font-sans">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Cara Setup Casaku (4 Langkah)
                </p>
                <ol className="space-y-2 text-sm text-emerald-700 dark:text-emerald-300">
                  <li className="flex items-start gap-2"><span className="font-bold shrink-0">1.</span> Daftar di <a href="https://casaku.id" target="_blank" rel="noopener" className="underline font-medium">casaku.id</a> dan upload gambar QRIS statis Anda</li>
                  <li className="flex items-start gap-2"><span className="font-bold shrink-0">2.</span> Buat API Keys di dashboard Casaku → salin <strong>License Key</strong> dan <strong>QR ID (UUID)</strong></li>
                  <li className="flex items-start gap-2"><span className="font-bold shrink-0">3.</span> Install app Casaku di HP Android yang menerima notifikasi e-wallet/m-banking</li>
                  <li className="flex items-start gap-2"><span className="font-bold shrink-0">4.</span> Daftarkan URL Webhook di bawah ke dashboard Casaku</li>
                </ol>
              </div>

              <form onSubmit={savePayment} className="space-y-5 max-w-xl font-sans">

                {/* License Key */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-foreground/80">License Key</label>
                  <input
                    id="casaku-license-key"
                    type="password"
                    value={(payment as any).casaku_license_key || ""}
                    onChange={(e) => setPayment({ ...payment, casaku_license_key: e.target.value } as any)}
                    className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono text-sm"
                    placeholder="Dari dashboard Casaku → API Keys"
                    autoComplete="off"
                  />
                </div>

                {/* Webhook Secret */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-foreground/80">Webhook Secret</label>
                  <input
                    id="casaku-webhook-secret"
                    type="password"
                    value={(payment as any).casaku_webhook_secret || ""}
                    onChange={(e) => setPayment({ ...payment, casaku_webhook_secret: e.target.value } as any)}
                    className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono text-sm"
                    placeholder="Dari dashboard Casaku → Webhook Settings"
                    autoComplete="off"
                  />
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-foreground/50">URL Webhook untuk dimasukkan di dashboard Casaku:</p>
                    <code className="text-xs bg-surface-alt px-2 py-1 rounded-lg border border-border font-mono select-all">
                      {typeof window !== "undefined" ? window.location.origin : "https://domainanda.com"}/api/webhook/casaku
                    </code>
                  </div>
                </div>

                {/* QR ID */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-foreground/80">QRIS Merchant ID (UUID)</label>
                  <input
                    id="casaku-qr-id"
                    type="text"
                    value={(payment as any).casaku_qr_id || ""}
                    onChange={(e) => setPayment({ ...payment, casaku_qr_id: e.target.value } as any)}
                    className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono text-sm"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                  <p className="text-xs text-foreground/50 mt-1.5">UUID QRIS Merchant yang muncul di dashboard Casaku setelah upload QRIS.</p>
                </div>

                {/* Metode Transfer Manual */}
                <h3 className="text-lg font-serif pt-6 border-t border-border text-foreground">Metode Transfer Manual (Alternatif)</h3>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/80">Nama Bank / E-Wallet</label>
                  <input
                    type="text"
                    value={payment.bankName}
                    onChange={(e) => setPayment({ ...payment, bankName: e.target.value })}
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
                      onChange={(e) => setPayment({ ...payment, accountNumber: e.target.value })}
                      className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                      placeholder="1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Atas Nama</label>
                    <input
                      type="text"
                      value={payment.accountName}
                      onChange={(e) => setPayment({ ...payment, accountName: e.target.value })}
                      className="w-full p-3.5 border border-border rounded-xl bg-background focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                      placeholder="Zeey Studio"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-4">
                  <button
                    type="submit"
                    id="save-payment-settings-btn"
                    className="bg-accent text-white px-8 py-3.5 rounded-xl font-medium hover:bg-accent-dark transition-all shadow-md cursor-pointer w-full md:w-auto"
                  >
                    Simpan Pengaturan
                  </button>
                  {isPaymentSaved && (
                    <span className="text-green-600 text-sm flex items-center gap-1 animate-in fade-in">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      Tersimpan!
                    </span>
                  )}
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
                        {item.scheme === 'sudah bayar' && <span className="ml-2 text-xs bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded border border-emerald-500/20">Sudah Bayar</span>}
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
                      <input type="text" required placeholder="Username" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.username} onChange={e => setAdminForm({ ...adminForm, username: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Nama Lengkap</label>
                      <input type="text" required placeholder="Nama Lengkap" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Password</label>
                      <input type="password" required={!editingAdminId} placeholder={editingAdminId ? "Kosongkan jika tidak diubah" : "Password"} className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">No. WhatsApp</label>
                      <input type="tel" required placeholder="08123456789" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.waNumber} onChange={e => setAdminForm({ ...adminForm, waNumber: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Posisi / Spesialisasi</label>
                      <select className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.specialization} onChange={e => setAdminForm({ ...adminForm, specialization: e.target.value })}>
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
                      <select className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.employmentStatus} onChange={e => setAdminForm({ ...adminForm, employmentStatus: e.target.value })}>
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Freelance">Freelance</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Informasi Rekening Bank</label>
                      <input type="text" placeholder="BCA - 12345678 a/n Budi" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.bankInfo} onChange={e => setAdminForm({ ...adminForm, bankInfo: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Komisi per Proyek (Opsional)</label>
                      <input type="text" placeholder="Misal: 100000" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.commission} onChange={e => setAdminForm({ ...adminForm, commission: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-foreground/70 mb-1 ml-1">Target Bulanan (KPI / Sales Target)</label>
                      <input type="text" placeholder="Misal: 20" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.kpiTarget} onChange={e => setAdminForm({ ...adminForm, kpiTarget: e.target.value })} />
                    </div>
                  </div>

                  <div className="mt-5 mb-2">
                    <label className="block text-sm font-medium mb-3 text-foreground/80">Hak Akses Modul:</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { id: 'create', label: 'Buat Booking Baru' },
                        { id: 'editor', label: 'Tugas Editor' },
                        { id: 'bookings', label: 'Daftar Pesanan' },
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
                              setAdminForm({ ...adminForm, accesses: newAccesses });
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {adminsList.map((adm) => (
                    <div key={adm.id} className="bg-background border border-border rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-accent/30 transition-all flex flex-col group relative">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 pr-3">
                          <h4 className="font-serif text-lg font-medium text-foreground leading-tight">{adm.name}</h4>
                          <span className="text-xs text-foreground/50 font-sans mt-1 block">@{adm.username} • {adm.specialization || "Admin"}</span>
                        </div>
                        {adm.employmentStatus && (
                           <span className="shrink-0 text-[10px] px-2.5 py-1 bg-surface-alt border border-border rounded-full text-foreground/70 uppercase tracking-wider font-bold">
                             {adm.employmentStatus}
                           </span>
                        )}
                      </div>

                      {(adm.commission || adm.kpiTarget || adm.waNumber) && (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1 mb-4 text-sm font-sans bg-surface-alt/30 p-3.5 rounded-xl border border-border/50">
                          {adm.waNumber && (
                            <div className="w-full mb-1 flex items-center gap-2 text-foreground/70">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                              <span className="text-xs font-medium">{adm.waNumber}</span>
                            </div>
                          )}
                          {adm.commission && Number(adm.commission) > 0 && (
                            <div>
                              <span className="block text-[10px] uppercase font-bold text-foreground/40 tracking-wider">Komisi</span>
                              <span className="text-green-600 font-medium text-sm">Rp {Number(adm.commission).toLocaleString("id-ID")}</span>
                            </div>
                          )}
                          {adm.kpiTarget && (
                            <div>
                              <span className="block text-[10px] uppercase font-bold text-foreground/40 tracking-wider">Target Bulanan</span>
                              <span className="text-foreground/80 font-medium text-sm">{adm.kpiTarget}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mb-6 flex-1">
                        <span className="block text-[10px] uppercase font-bold text-foreground/40 tracking-wider mb-2">Akses Modul:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {adm.accesses?.length > 0 ? adm.accesses.map((acc: string) => (
                            <span key={acc} className="px-2 py-1 bg-accent/10 text-accent border border-accent/20 rounded-md text-[10px] uppercase font-bold tracking-wider">
                              {acc}
                            </span>
                          )) : (
                            <span className="text-xs text-foreground/40 italic">Tidak ada akses khusus</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-border/50 mt-auto">
                        <button onClick={() => handleEditAdmin(adm)} className="flex-1 py-2.5 bg-surface hover:bg-surface-alt border border-border text-foreground text-sm font-medium rounded-xl transition-all cursor-pointer">
                          Edit
                        </button>
                        <button onClick={() => handleDeleteAdmin(adm.id)} className="flex-1 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition-all cursor-pointer border border-red-100">
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {adminsList.length === 0 && (
                    <div className="col-span-full text-center p-12 bg-surface-alt/30 rounded-3xl border border-dashed border-border">
                      <p className="text-foreground/60">Belum ada akun admin.</p>
                    </div>
                  )}
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
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full p-3 border border-border rounded-lg focus:outline-none focus:border-accent bg-background"
                    placeholder="e.g., per bingkai"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Skema Harga</label>
                  <select
                    value={formData.scheme}
                    onChange={e => setFormData({ ...formData, scheme: e.target.value })}
                    className="w-full p-3 border border-border rounded-lg focus:outline-none focus:border-accent bg-background"
                  >
                    <option value="berbayar">Berbayar (Akan ditambahkan ke total)</option>
                    <option value="sudah bayar">Sudah Bayar (Tidak menambah total)</option>
                  </select>
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
