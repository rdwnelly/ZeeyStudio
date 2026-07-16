"use client";

import { useState, useEffect } from "react";
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
};

export default function CreateBookingPage() {
  const [clientName, setClientName] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  
  const [shootDate, setShootDate] = useState("");
  const [shootTime, setShootTime] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [maxPhotos, setMaxPhotos] = useState<number | "">("");
  const [assignedAdmin, setAssignedAdmin] = useState("");

  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedProject, setGeneratedProject] = useState<Project | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [priceList, setPriceList] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load Admins
        const adminSnap = await getDocs(collection(db, "admins"));
        const admins = adminSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAdminsList(admins);

        // Load Pricelist
        const priceSnap = await getDocs(collection(db, "pricelist"));
        let prices = priceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Exclude system items if you want, or keep them. Let's keep all.
        setPriceList(prices);
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
    
    // Get Package Info
    const pkg = priceList.find(p => p.id === selectedPackage);

    const newProject: Project = {
      id,
      clientName,
      waNumber,
      clientEmail: clientEmail.trim() || undefined,
      maxPhotos: Number(maxPhotos) || 0,
      createdAt: new Date().toISOString(),
      status: 'Menunggu Pembayaran',
      createdBy: localStorage.getItem('zeey_auth_user') || 'Owner',
      shootDate,
      shootTime,
      packageId: pkg?.id,
      packageName: pkg?.name,
      packagePrice: pkg?.price,
      assignedAdmin: assignedAdmin
    };

    try {
      await setDoc(doc(db, "projects", id), newProject);

      const link = `${window.location.origin}/client/${id}`;
      setGeneratedLink(link);
      setGeneratedProject(newProject);
      
      // Reset form
      setClientName("");
      setWaNumber("");
      setClientEmail("");
      setShootDate("");
      setShootTime("");
      setSelectedPackage("");
      setMaxPhotos("");
      setAssignedAdmin("");
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
          <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Buat Booking Baru</h1>
          <p className="text-foreground/70 font-sans text-sm md:text-base">Daftarkan pesanan klien, atur jadwal, dan tugaskan fotografer.</p>
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

            <div>
              <label className="block text-sm font-medium mb-2">Tugaskan Fotografer (Admin)</label>
              <select 
                required
                className="w-full p-3.5 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                value={assignedAdmin}
                onChange={(e) => setAssignedAdmin(e.target.value)}
              >
                <option value="">-- Pilih Fotografer --</option>
                {adminsList.map(a => (
                  <option key={a.id} value={a.username}>{a.name} ({a.username})</option>
                ))}
              </select>
            </div>

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
              {isSubmitting ? 'Memproses...' : 'Buat Pesanan & Jadwal'}
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
