"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  clientEmail?: string;
  createdAt: string;
  clientType?: 'Reguler' | 'VIP' | 'Blacklist';
  leadSource?: string;
  socialMedia?: string;
};

type ClientData = {
  waNumber: string;
  name: string;
  email: string;
  totalOrders: number;
  lastOrderDate: string;
  clientType: 'Reguler' | 'VIP' | 'Blacklist';
  leadSource: string;
  socialMedia: string;
  originalWaNumber?: string;
};

export default function CRMPage() {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "projects"));
      const snapshot = await getDocs(q);
      
      const clientMap = new Map<string, ClientData>();
      
      snapshot.forEach(doc => {
        const data = doc.data() as Project;
        const wa = data.waNumber || "Unknown";
        
        if (clientMap.has(wa)) {
          const existing = clientMap.get(wa)!;
          existing.totalOrders += 1;
          if (new Date(data.createdAt) > new Date(existing.lastOrderDate)) {
            existing.lastOrderDate = data.createdAt;
            existing.name = data.clientName;
            if (data.clientEmail) existing.email = data.clientEmail;
            if (data.clientType) existing.clientType = data.clientType;
            if (data.leadSource) existing.leadSource = data.leadSource;
            if (data.socialMedia) existing.socialMedia = data.socialMedia;
          }
        } else {
          clientMap.set(wa, {
            waNumber: wa,
            originalWaNumber: wa,
            name: data.clientName || "Unknown",
            email: data.clientEmail || "-",
            totalOrders: 1,
            lastOrderDate: data.createdAt || new Date().toISOString(),
            clientType: data.clientType || 'Reguler',
            leadSource: data.leadSource || '-',
            socialMedia: data.socialMedia || '-'
          });
        }
      });
      
      const clientsArray = Array.from(clientMap.values());
      clientsArray.sort((a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());
      
      setClients(clientsArray);
    } catch (error) {
      console.error("Error fetching CRM data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("zeey_auth_role");
    if (role !== "owner") {
      router.push("/dashboard");
      return;
    }

    fetchClients();
  }, [router]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editingClient.originalWaNumber) return;
    
    setIsSubmitting(true);
    try {
      const q = query(collection(db, "projects"), where("waNumber", "==", editingClient.originalWaNumber));
      const snap = await getDocs(q);
      
      const promises = snap.docs.map(d => updateDoc(doc(db, "projects", d.id), {
        clientName: editingClient.name,
        waNumber: editingClient.waNumber,
        clientEmail: editingClient.email,
        clientType: editingClient.clientType,
        leadSource: editingClient.leadSource,
        socialMedia: editingClient.socialMedia
      }));
      
      await Promise.all(promises);
      
      const { logActivity } = await import("@/lib/audit");
      await logActivity("Update Klien", `Mengubah data klien ${editingClient.name}`);
      
      setIsEditModalOpen(false);
      setEditingClient(null);
      fetchClients();
    } catch (err) {
      console.error("Gagal mengupdate klien", err);
      alert("Gagal mengupdate data klien.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (waNumber: string, name: string, total: number) => {
    if (confirm(`Yakin ingin MENGHAPUS klien "${name}" beserta seluruh ${total} riwayat pesanannya?\n\nTindakan ini permanen dan tidak dapat dibatalkan!`)) {
      try {
        const q = query(collection(db, "projects"), where("waNumber", "==", waNumber));
        const snap = await getDocs(q);
        
        const promises = snap.docs.map(d => deleteDoc(doc(db, "projects", d.id)));
        await Promise.all(promises);

        // Clear matching projects from localStorage
        try {
          const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
          const updatedLocal = savedProjects.filter((p: any) => p.waNumber !== waNumber);
          localStorage.setItem("zeey_projects", JSON.stringify(updatedLocal));
        } catch (e) {
          console.warn("Notice updating local storage on delete CRM:", e);
        }
        
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Hapus Klien", `Menghapus klien ${name} beserta ${total} pesanannya.`);
        
        alert("Klien dan seluruh pesanannya berhasil dihapus.");
        fetchClients();
      } catch (err) {
        console.error("Gagal menghapus", err);
        alert("Gagal menghapus klien.");
      }
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.waNumber.includes(searchQuery) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ["Nama Klien", "Tipe Klien", "Sumber (Lead)", "Sosial Media", "WhatsApp", "Email", "Total Pesanan", "Tanggal Pesanan Terakhir"];
    const csvRows = [
      headers.join(","),
      ...filteredClients.map(c => [
        `"${c.name}"`, 
        `"${c.clientType}"`,
        `"${c.leadSource}"`,
        `"${c.socialMedia}"`,
        `"${c.waNumber}"`, 
        `"${c.email}"`, 
        c.totalOrders, 
        `"${new Date(c.lastOrderDate).toLocaleDateString('id-ID')}"`
      ].join(","))
    ];
    
    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Data_Klien_ZeeyStudio_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Sidebar>
      <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto w-full animate-in fade-in duration-500 pb-24">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 border-b border-border/50 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Data Klien (CRM)</h1>
            <p className="text-foreground/70 font-sans text-sm md:text-base">Kelola daftar pelanggan, riwayat pesanan, dan kontak WhatsApp.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={exportToCSV}
              className="flex-1 md:flex-none bg-surface border border-border text-foreground px-5 py-2.5 rounded-xl font-medium hover:bg-surface-alt transition-all shadow-sm text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              Ekspor CSV
            </button>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 md:p-6 border-b border-border bg-surface-alt/30 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-serif">Total Pelanggan Unik: <span className="text-accent">{clients.length}</span></h2>
            
            <div className="relative w-full sm:w-72">
              <input 
                type="text" 
                placeholder="Cari nama, WA, atau email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
              />
              <svg className="w-5 h-5 absolute left-3 top-2.5 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans min-w-[800px]">
              <thead className="bg-surface-alt/50 text-sm text-foreground/70 border-b border-border">
                <tr>
                  <th className="p-4 font-medium pl-6">Nama Pelanggan</th>
                  <th className="p-4 font-medium">Kontak & Sosmed</th>
                  <th className="p-4 font-medium text-center">Riwayat Pesanan</th>
                  <th className="p-4 font-medium">Pesanan Terakhir</th>
                  <th className="p-4 font-medium text-right pr-6">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center">
                      <div className="w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-foreground/50 text-sm animate-pulse">Memuat data pelanggan...</p>
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-foreground/50">Tidak ada pelanggan yang ditemukan.</td>
                  </tr>
                ) : (
                  filteredClients.map((client, idx) => {
                    let cleanNumber = client.waNumber.replace(/[^0-9]/g, "");
                    if (cleanNumber.startsWith("0")) {
                      cleanNumber = "62" + cleanNumber.substring(1);
                    }
                    
                    return (
                      <tr key={idx} className="hover:bg-surface-alt/30 transition-colors group">
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-2 font-medium text-foreground">
                            {client.name}
                            {client.clientType === 'VIP' && (
                              <span className="text-[10px] px-2 py-0.5 bg-yellow-500/20 text-yellow-600 border border-yellow-500/30 rounded-full font-bold">VIP</span>
                            )}
                            {client.clientType === 'Blacklist' && (
                              <span className="text-[10px] px-2 py-0.5 bg-red-500/20 text-red-600 border border-red-500/30 rounded-full font-bold">BLACKLIST</span>
                            )}
                          </div>
                          {client.leadSource !== '-' && (
                            <div className="text-[10px] text-foreground/50 mt-1">Sumber: {client.leadSource}</div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col text-sm">
                            <span className="text-foreground/80">{client.waNumber}</span>
                            {client.socialMedia !== "-" && <span className="text-accent text-xs mt-0.5">{client.socialMedia}</span>}
                            {client.email !== "-" && <span className="text-foreground/50 text-xs mt-0.5">{client.email}</span>}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center justify-center bg-accent/10 text-accent font-semibold w-8 h-8 rounded-full border border-accent/20">
                            {client.totalOrders}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-foreground/70">
                          {new Date(client.lastOrderDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex justify-end gap-2">
                            <a 
                              href={`https://wa.me/${cleanNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white rounded-lg text-xs font-medium transition-colors"
                              title="Hubungi WA"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </a>
                            <button 
                              onClick={() => { setEditingClient({...client}); setIsEditModalOpen(true); }}
                              className="inline-flex items-center px-3 py-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white rounded-lg text-xs font-medium transition-colors"
                              title="Edit Klien"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button 
                              onClick={() => handleDelete(client.waNumber, client.name, client.totalOrders)}
                              className="inline-flex items-center px-3 py-1.5 bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-xs font-medium transition-colors"
                              title="Hapus Klien & Pesanan"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Edit Klien */}
      {isEditModalOpen && editingClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-surface-alt/50">
              <h3 className="text-xl font-serif">Edit Data Klien</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-foreground/50 hover:text-foreground">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="edit-client-form" onSubmit={handleEditSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-foreground/80 mb-2">Nama Pelanggan</label>
                  <input type="text" value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground/80 mb-2">Nomor WhatsApp</label>
                  <input type="text" value={editingClient.waNumber} onChange={e => setEditingClient({...editingClient, waNumber: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none" required />
                  <p className="text-[11px] text-foreground/50 mt-1">Mengubah WA akan menggabungkan/memisahkan pesanan ini dari riwayat aslinya.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-foreground/80 mb-2">Tipe Klien</label>
                    <select value={editingClient.clientType} onChange={e => setEditingClient({...editingClient, clientType: e.target.value as any})} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none">
                      <option value="Reguler">Reguler</option>
                      <option value="VIP">VIP</option>
                      <option value="Blacklist">Blacklist</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground/80 mb-2">Sosial Media (IG/TikTok)</label>
                    <input type="text" value={editingClient.socialMedia} onChange={e => setEditingClient({...editingClient, socialMedia: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground/80 mb-2">Alamat Email (Opsional)</label>
                  <input type="email" value={editingClient.email === '-' ? '' : editingClient.email} onChange={e => setEditingClient({...editingClient, email: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground/80 mb-2">Sumber Lead (Darimana tahu studio?)</label>
                  <input type="text" value={editingClient.leadSource} onChange={e => setEditingClient({...editingClient, leadSource: e.target.value})} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none" />
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-border bg-surface-alt/30 flex justify-end gap-3">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-border font-medium hover:bg-border transition-colors text-sm">Batal</button>
              <button type="submit" form="edit-client-form" disabled={isSubmitting} className="px-6 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors shadow-md disabled:opacity-50 text-sm flex items-center gap-2">
                {isSubmitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Menyimpan...</> : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
