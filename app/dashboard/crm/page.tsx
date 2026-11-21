"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Icon, PageHeader, SkeletonBlock, StatCard } from "@/components/ui";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { normalizeWaNumber } from "@/lib/phone";

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
  // Semua variasi penulisan nomor (08…, 628…, +62…) milik klien ini
  rawWaNumbers?: string[];
};

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-pink-500 to-rose-500",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-purple-500 to-fuchsia-500",
];

/** Logo WhatsApp (ikon isi penuh). */
function WaIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

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
        const raw = data.waNumber || "";
        // Kunci identitas = nomor ternormalisasi, sehingga 0812… dan 62812… adalah klien yang sama
        const wa = normalizeWaNumber(raw) || "Unknown";

        if (clientMap.has(wa)) {
          const existing = clientMap.get(wa)!;
          existing.totalOrders += 1;
          if (raw && !existing.rawWaNumbers!.includes(raw)) existing.rawWaNumbers!.push(raw);
          if (new Date(data.createdAt) > new Date(existing.lastOrderDate)) {
            existing.lastOrderDate = data.createdAt;
            existing.name = data.clientName;
            existing.waNumber = raw || existing.waNumber;
            existing.originalWaNumber = raw || existing.originalWaNumber;
            if (data.clientEmail) existing.email = data.clientEmail;
            if (data.clientType) existing.clientType = data.clientType;
            if (data.leadSource) existing.leadSource = data.leadSource;
            if (data.socialMedia) existing.socialMedia = data.socialMedia;
          }
        } else {
          clientMap.set(wa, {
            waNumber: raw || wa,
            originalWaNumber: raw || wa,
            rawWaNumbers: raw ? [raw] : [],
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
    let accesses: string[] = [];
    try { accesses = JSON.parse(localStorage.getItem("zeey_auth_access") || "[]"); } catch {}
    // Owner, atau admin yang diberi hak akses modul CRM di Pengaturan
    if (role !== "owner" && !accesses.includes("crm")) {
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
      const variants = editingClient.rawWaNumbers?.length ? editingClient.rawWaNumbers : [editingClient.originalWaNumber];
      const docs = await getProjectDocsByWa(variants);

      const promises = docs.map(d => updateDoc(doc(db, "projects", d.id), {
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

  // Ambil semua proyek milik klien untuk seluruh variasi nomor WA (kueri "in" maks. 30 nilai)
  const getProjectDocsByWa = async (variants: string[]) => {
    const unique = Array.from(new Set(variants.filter(Boolean)));
    const results = [];
    for (let i = 0; i < unique.length; i += 30) {
      const snap = await getDocs(query(collection(db, "projects"), where("waNumber", "in", unique.slice(i, i + 30))));
      results.push(...snap.docs);
    }
    return results;
  };

  const handleDelete = async (client: ClientData) => {
    const { name, totalOrders: total } = client;
    const variants = client.rawWaNumbers?.length ? client.rawWaNumbers : [client.waNumber];
    if (confirm(`Yakin ingin MENGHAPUS klien "${name}" beserta seluruh ${total} riwayat pesanannya?\n\nTindakan ini permanen dan tidak dapat dibatalkan!`)) {
      try {
        const docs = await getProjectDocsByWa(variants);
        const promises = docs.map(d => deleteDoc(doc(db, "projects", d.id)));
        await Promise.all(promises);

        // Clear matching projects from localStorage
        try {
          const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
          const updatedLocal = savedProjects.filter((p: any) => !variants.includes(p.waNumber));
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

  // Angka ringkasan pelanggan
  const vipCount = clients.filter(c => c.clientType === 'VIP').length;
  const blacklistCount = clients.filter(c => c.clientType === 'Blacklist').length;
  const repeatCount = clients.filter(c => c.totalOrders > 1).length;

  return (
    <Sidebar>
      <div className="p-3.5 md:p-6 lg:p-8 max-w-6xl mx-auto w-full pb-8">
        <PageHeader
          module="crm"
          title="Data Klien (CRM)"
          subtitle="Kelola daftar pelanggan, riwayat pesanan, dan kontak WhatsApp."
          actions={
            <button 
              onClick={exportToCSV}
              className="flex-1 md:flex-none bg-surface border border-border text-foreground px-5 py-2.5 rounded-xl font-medium hover:bg-surface-alt transition-all shadow-sm text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              Ekspor CSV
            </button>
          }
        />

        {/* ── Ringkasan pelanggan ──────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 stagger">
          <StatCard label="Total Pelanggan" value={clients.length} hint="Nomor WA unik" tone="violet" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          <StatCard label="Klien VIP" value={vipCount} hint="Pelanggan prioritas" tone="amber" icon="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          <StatCard label="Pelanggan Berulang" value={repeatCount} hint="Lebih dari 1 pesanan" tone="emerald" icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          <StatCard label="Blacklist" value={blacklistCount} hint="Perlu kehati-hatian" tone="pink" icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </div>

        {/* ── Pencarian ────────────────────────────────────────────── */}
        <div className="relative mb-4">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-foreground/35">
            <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" className="w-[18px] h-[18px]" />
          </span>
          <input
            type="text"
            placeholder="Cari nama, nomor WA, atau email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-surface border border-border/70 text-sm shadow-sm transition-all"
          />
        </div>

        {/* ── Kisi kartu pelanggan ─────────────────────────────────── */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} className="h-44" />)}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface-alt/30 py-14 text-center animate-in fade-in">
            <span className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-surface border border-border/60 flex items-center justify-center text-foreground/30">
              <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" className="w-6 h-6" />
            </span>
            <p className="text-sm font-semibold text-foreground/70">
              {searchQuery ? "Pelanggan tidak ditemukan" : "Belum ada data pelanggan"}
            </p>
            {searchQuery && <p className="mt-1 text-xs text-foreground/50">Coba kata kunci lain.</p>}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 stagger">
            {filteredClients.map((client, idx) => {
              const cleanNumber = normalizeWaNumber(client.waNumber);
              const warna = AVATAR_GRADIENTS[(client.name || "?").charCodeAt(0) % AVATAR_GRADIENTS.length];
              const vip = client.clientType === "VIP";
              const blacklist = client.clientType === "Blacklist";
              return (
                <article
                  key={idx}
                  className={`relative overflow-hidden rounded-3xl bg-surface border shadow-sm p-4 flex flex-col gap-3 lift ${
                    blacklist ? "border-red-500/40" : vip ? "border-amber-500/40" : "border-border/70"
                  }`}
                >
                  <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${blacklist ? "from-rose-500 to-red-600" : vip ? "from-amber-400 to-orange-500" : warna} opacity-80`} />

                  <header className="flex items-start gap-3 pt-1">
                    <span className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${warna} text-white font-bold flex items-center justify-center shrink-0 shadow-md`}>
                      {(client.name || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm leading-tight truncate" title={client.name}>{client.name}</h3>
                        {vip && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">VIP</span>}
                        {blacklist && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400">BLACKLIST</span>}
                      </div>
                      <p className="text-[11px] text-foreground/55 truncate">{client.waNumber}</p>
                      {client.socialMedia !== "-" && <p className="text-[11px] text-accent truncate">{client.socialMedia}</p>}
                      {client.email !== "-" && <p className="text-[11px] text-foreground/45 truncate" title={client.email}>{client.email}</p>}
                    </div>
                  </header>

                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-2xl bg-surface-alt/60 px-3 py-2">
                      <dt className="text-foreground/45 font-medium">Pesanan</dt>
                      <dd className="font-bold text-accent tabular-nums">{client.totalOrders}×</dd>
                    </div>
                    <div className="rounded-2xl bg-surface-alt/60 px-3 py-2 min-w-0">
                      <dt className="text-foreground/45 font-medium">Terakhir</dt>
                      <dd className="font-semibold truncate">
                        {new Date(client.lastOrderDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </dd>
                    </div>
                  </dl>

                  {client.leadSource !== "-" && (
                    <p className="text-[11px] text-foreground/45">Sumber: <span className="font-medium text-foreground/70">{client.leadSource}</span></p>
                  )}

                  <div className="mt-auto flex items-center gap-2">
                    <a
                      href={`https://wa.me/${cleanNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Hubungi via WhatsApp"
                      className="flex-1 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-[11px] font-bold shadow-md shadow-emerald-500/25 hover:brightness-110 transition-all flex items-center justify-center gap-1.5 press"
                    >
                      <WaIcon className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                    <button
                      onClick={() => { setEditingClient({ ...client }); setIsEditModalOpen(true); }}
                      title="Edit data klien"
                      className="w-9 h-9 rounded-xl bg-surface-alt/70 border border-border/60 hover:bg-surface-alt hover:text-blue-500 transition-colors flex items-center justify-center cursor-pointer press"
                    >
                      <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(client)}
                      title="Hapus klien & seluruh pesanannya"
                      className="w-9 h-9 rounded-xl bg-surface-alt/70 border border-border/60 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors flex items-center justify-center cursor-pointer press"
                    >
                      <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Edit Klien */}
      {isEditModalOpen && editingClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-surface w-full max-w-lg rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-surface-alt/50">
              <h3 className="text-base md:text-lg font-bold tracking-tight">Edit Data Klien</h3>
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
