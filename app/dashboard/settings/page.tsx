"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";

export type PriceItem = {
  id: string;
  name: string;
  price: number;
  unit: string;
  isSystem?: boolean; 
};

const DEFAULT_PRICELIST: PriceItem[] = [
  { id: "extra_photo", name: "Foto Tambahan", price: 50000, unit: "per foto", isSystem: true },
  { id: "print_album", name: "Cetak Album 20 Halaman", price: 500000, unit: "per album" },
  { id: "softcopy_all", name: "Softcopy Seluruh Foto (Google Drive)", price: 1500000, unit: "paket" }
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profil' | 'pembayaran' | 'harga' | 'admin'>('profil');
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
  const [payment, setPayment] = useState({ cashifyApiKey: "", cashifyWebhookSecret: "", qrisString: "", bankName: "", accountNumber: "", accountName: "" });
  const [isPaymentSaved, setIsPaymentSaved] = useState(false);

  // --- ADMIN STATE ---
  const [adminsList, setAdminsList] = useState<Array<{ id: string; username: string; name: string }>>([]);
  const [adminForm, setAdminForm] = useState({ username: "", name: "", password: "" });
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  const loadAdmins = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "admins"));
      const admins = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; username: string; name: string }));
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
          const prices = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PriceItem));
          // Sort system items first
          prices.sort((a, b) => (a.isSystem === b.isSystem ? 0 : a.isSystem ? -1 : 1));
          setPriceList(prices);
        } else {
          // If empty, initialize with default and save to Firestore
          setPriceList(DEFAULT_PRICELIST);
          for (const item of DEFAULT_PRICELIST) {
            await addDoc(collection(db, "pricelist"), item);
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

    // Load Payment
    const savedPayment = JSON.parse(localStorage.getItem("zeey_payment") || "null");
    if (savedPayment) setPayment(savedPayment);

    // Load Admins
    loadAdmins();
  }, []);

  // --- HARGA HANDLERS ---
  const loadPricesFromDb = async () => {
    const querySnapshot = await getDocs(collection(db, "pricelist"));
    const prices = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as PriceItem));
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
        // Wait, if it's a default item that didn't get added properly (no id match), this might fail, 
        // but we saved it to firestore, so it has a firestore doc id (unless it's the hardcoded ID from DEFAULT_PRICELIST).
        // Let's just use `setDoc(doc(db, "pricelist", editingItem.id), ...)`
        const { setDoc } = await import("firebase/firestore");
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
        await deleteDoc(doc(db, "pricelist", id));
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
  const savePayment = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("zeey_payment", JSON.stringify(payment));
    setIsPaymentSaved(true);
    setTimeout(() => setIsPaymentSaved(false), 3000);
  };

  // --- ADMIN HANDLERS ---
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdminLoading(true);
    try {
      await addDoc(collection(db, "admins"), {
        username: adminForm.username,
        name: adminForm.name,
        password: adminForm.password,
        createdAt: new Date().toISOString()
      });
      setAdminForm({ username: "", name: "", password: "" });
      loadAdmins();
    } catch (err) {
      console.error(err);
      alert("Gagal menambahkan admin");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (confirm("Hapus admin ini?")) {
      try {
        await deleteDoc(doc(db, "admins", id));
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
        </div>

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
                  <h3 className="font-medium mb-4">Tambah Admin Baru</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <input type="text" required placeholder="Username" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.username} onChange={e => setAdminForm({...adminForm, username: e.target.value})} />
                    </div>
                    <div>
                      <input type="text" required placeholder="Nama Lengkap" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.name} onChange={e => setAdminForm({...adminForm, name: e.target.value})} />
                    </div>
                    <div>
                      <input type="password" required placeholder="Password" className="w-full p-3.5 border border-border rounded-xl bg-surface focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all" value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} />
                    </div>
                  </div>
                  <button type="submit" disabled={isAdminLoading} className="mt-5 w-full md:w-auto bg-accent text-white px-8 py-3.5 rounded-xl font-medium hover:bg-accent-dark transition-all cursor-pointer disabled:opacity-70 shadow-sm">
                    {isAdminLoading ? "Menyimpan..." : "Tambah Admin"}
                  </button>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans">
                    <thead className="bg-surface-alt/50 text-sm text-foreground/70">
                      <tr>
                        <th className="p-4 font-medium">Username</th>
                        <th className="p-4 font-medium">Nama</th>
                        <th className="p-4 font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {adminsList.map((adm) => (
                        <tr key={adm.id} className="hover:bg-surface-alt/10">
                          <td className="p-4 font-medium">{adm.username}</td>
                          <td className="p-4 text-foreground/80">{adm.name}</td>
                          <td className="p-4 text-right">
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
