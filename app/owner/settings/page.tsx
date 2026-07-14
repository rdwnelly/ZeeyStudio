"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

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
  const [activeTab, setActiveTab] = useState<'profil' | 'pembayaran' | 'harga'>('profil');

  // --- HARGA STATE ---
  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
  const [formData, setFormData] = useState({ name: "", price: "", unit: "" });

  // --- PROFIL STATE ---
  const [profile, setProfile] = useState({ studioName: "Zeey Studio", waNumber: "", logoUrl: "" });
  const [isProfileSaved, setIsProfileSaved] = useState(false);

  // --- PEMBAYARAN STATE ---
  const [payment, setPayment] = useState({ midtransServerKey: "", midtransClientKey: "", bankName: "", accountNumber: "", accountName: "" });
  const [isPaymentSaved, setIsPaymentSaved] = useState(false);

  useEffect(() => {
    // Load Prices
    const savedList = JSON.parse(localStorage.getItem("zeey_pricelist") || "null");
    if (savedList && savedList.length > 0) {
      setPriceList(savedList);
    } else {
      setPriceList(DEFAULT_PRICELIST);
      localStorage.setItem("zeey_pricelist", JSON.stringify(DEFAULT_PRICELIST));
    }

    // Load Profile
    const savedProfile = JSON.parse(localStorage.getItem("zeey_profile") || "null");
    if (savedProfile) setProfile(savedProfile);

    // Load Payment
    const savedPayment = JSON.parse(localStorage.getItem("zeey_payment") || "null");
    if (savedPayment) setPayment(savedPayment);
  }, []);

  // --- HARGA HANDLERS ---
  const saveList = (newList: PriceItem[]) => {
    setPriceList(newList);
    localStorage.setItem("zeey_pricelist", JSON.stringify(newList));
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

  const handlePriceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceValue = parseInt(formData.price.replace(/[^0-9]/g, "")) || 0;
    
    if (editingItem) {
      const updatedList = priceList.map(item => 
        item.id === editingItem.id ? { ...item, name: formData.name, price: priceValue, unit: formData.unit } : item
      );
      saveList(updatedList);
    } else {
      const newItem: PriceItem = {
        id: crypto.randomUUID(),
        name: formData.name,
        price: priceValue,
        unit: formData.unit
      };
      saveList([...priceList, newItem]);
    }
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus item ini?")) {
      const updatedList = priceList.filter(item => item.id !== id);
      saveList(updatedList);
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

  return (
    <Sidebar>
      <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="mb-10 border-b border-border pb-6">
          <h1 className="text-3xl md:text-4xl text-foreground mb-2">Pengaturan Dashboard</h1>
          <p className="text-foreground/70 font-sans">Kelola profil studio, integrasi pembayaran, dan daftar harga.</p>
        </div>

        {/* Custom Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-border pb-1">
          <button 
            onClick={() => setActiveTab('profil')} 
            className={`px-6 py-3 font-medium text-sm rounded-t-lg transition-colors cursor-pointer ${activeTab === 'profil' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Profil Studio
          </button>
          <button 
            onClick={() => setActiveTab('pembayaran')} 
            className={`px-6 py-3 font-medium text-sm rounded-t-lg transition-colors cursor-pointer ${activeTab === 'pembayaran' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Metode Pembayaran
          </button>
          <button 
            onClick={() => setActiveTab('harga')} 
            className={`px-6 py-3 font-medium text-sm rounded-t-lg transition-colors cursor-pointer ${activeTab === 'harga' ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Daftar Harga
          </button>
        </div>

        {/* Tab Content: Profil */}
        {activeTab === 'profil' && (
          <div className="bg-surface border border-border rounded-2xl shadow-md p-8 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-2xl font-serif mb-6">Informasi Studio</h2>
            <form onSubmit={saveProfile} className="space-y-6 max-w-xl font-sans">
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground/80">Nama Studio</label>
                <input 
                  type="text" 
                  value={profile.studioName}
                  onChange={(e) => setProfile({...profile, studioName: e.target.value})}
                  className="w-full p-3 border border-border rounded-lg bg-background focus:border-accent outline-none transition-colors"
                  placeholder="Contoh: Zeey Studio"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground/80">Nomor WhatsApp Admin</label>
                <input 
                  type="text" 
                  value={profile.waNumber}
                  onChange={(e) => setProfile({...profile, waNumber: e.target.value})}
                  className="w-full p-3 border border-border rounded-lg bg-background focus:border-accent outline-none transition-colors"
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
                  className="w-full p-3 border border-border rounded-lg bg-background focus:border-accent outline-none transition-colors"
                  placeholder="https://..."
                />
              </div>
              
              <div className="pt-4 flex items-center gap-4">
                <button type="submit" className="bg-accent text-white px-8 py-3 rounded-lg font-medium hover:bg-accent-dark transition-colors shadow-md cursor-pointer">
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
            <div className="bg-surface border border-border rounded-2xl shadow-md p-8">
              <div className="flex items-start gap-4 mb-6 pb-6 border-b border-border">
                <div className="bg-accent/10 p-3 rounded-xl text-accent">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                </div>
                <div>
                  <h2 className="text-2xl font-serif mb-1">Integrasi Midtrans (QRIS)</h2>
                  <p className="text-foreground/60 font-sans text-sm">Hubungkan akun Midtrans Anda untuk menerima pembayaran otomatis dari klien.</p>
                </div>
              </div>
              
              <form onSubmit={savePayment} className="space-y-6 max-w-xl font-sans">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/80">Midtrans Server Key</label>
                  <input 
                    type="password" 
                    value={payment.midtransServerKey}
                    onChange={(e) => setPayment({...payment, midtransServerKey: e.target.value})}
                    className="w-full p-3 border border-border rounded-lg bg-background focus:border-accent outline-none transition-colors"
                    placeholder="SB-Mid-server-..."
                  />
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded border border-amber-200">
                    ⚠️ Untuk keamanan maksimal, sangat disarankan untuk mengatur Server Key secara langsung di file <code className="font-bold">.env.local</code> di server Anda (bukan disimpan di memori browser).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/80">Midtrans Client Key</label>
                  <input 
                    type="text" 
                    value={payment.midtransClientKey}
                    onChange={(e) => setPayment({...payment, midtransClientKey: e.target.value})}
                    className="w-full p-3 border border-border rounded-lg bg-background focus:border-accent outline-none transition-colors"
                    placeholder="SB-Mid-client-..."
                  />
                </div>
                
                <h3 className="text-lg font-serif pt-6 border-t border-border text-foreground">Metode Transfer Manual (Alternatif)</h3>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground/80">Nama Bank / E-Wallet</label>
                  <input 
                    type="text" 
                    value={payment.bankName}
                    onChange={(e) => setPayment({...payment, bankName: e.target.value})}
                    className="w-full p-3 border border-border rounded-lg bg-background focus:border-accent outline-none transition-colors"
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
                      className="w-full p-3 border border-border rounded-lg bg-background focus:border-accent outline-none transition-colors"
                      placeholder="1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground/80">Atas Nama</label>
                    <input 
                      type="text" 
                      value={payment.accountName}
                      onChange={(e) => setPayment({...payment, accountName: e.target.value})}
                      className="w-full p-3 border border-border rounded-lg bg-background focus:border-accent outline-none transition-colors"
                      placeholder="Zeey Studio"
                    />
                  </div>
                </div>
                
                <div className="pt-4 flex items-center gap-4">
                  <button type="submit" className="bg-accent text-white px-8 py-3 rounded-lg font-medium hover:bg-accent-dark transition-colors shadow-md cursor-pointer">
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
          <div className="bg-surface border border-border rounded-2xl shadow-md overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="p-6 border-b border-border bg-surface-alt/30 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-serif">Daftar Harga (Price List)</h2>
                <p className="text-sm text-foreground/60 mt-1">Daftar ini ditampilkan kepada klien di Galeri.</p>
              </div>
              <button 
                onClick={() => handleOpenModal()}
                className="bg-accent text-white px-4 py-2 rounded-lg font-medium hover:bg-accent-dark transition-colors shadow-md text-sm cursor-pointer whitespace-nowrap"
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
      </div>

      {/* Item Modal (Harga) */}
      {isModalOpen && activeTab === 'harga' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6">
              <h2 className="text-2xl font-serif mb-6">{editingItem ? "Edit Harga" : "Tambah Harga Baru"}</h2>
              <form onSubmit={handlePriceSubmit} className="space-y-4 font-sans">
                <div>
                  <label className="block text-sm font-medium mb-1">Nama Layanan</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 border border-border rounded-lg focus:outline-none focus:border-accent bg-background"
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
                
                <div className="flex gap-4 pt-4 mt-4 border-t border-border">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-3 border border-border rounded-lg hover:bg-surface-alt transition-colors cursor-pointer font-medium"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors cursor-pointer font-medium shadow-md"
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
