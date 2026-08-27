"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export type SubToken = {
  id: string;
  name: string;
  maxPhotos: number;
  selectedPhotoIds?: string[];
  previouslySelectedPhotoIds?: string[];
  status?: 'Menunggu Pemilihan' | 'Selesai';
  completedAt?: string;
};

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  maxPhotos: number;
  subTokens?: SubToken[];
  previouslySelectedPhotoIds?: string[];
  isReopened?: boolean;
  status?: string;
};

interface MultiTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onProjectUpdated?: () => void;
}

export default function MultiTokenModal({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
}: MultiTokenModalProps) {
  const [numPeople, setNumPeople] = useState<number>(2);
  const [subTokenDrafts, setSubTokenDrafts] = useState<{ name: string; maxPhotos: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'view' | 'create'>('view');

  const generateDrafts = useCallback((count: number, totalMax: number) => {
    const validCount = Math.max(1, count);
    const perPersonQuota = Math.floor(totalMax / validCount);
    const remainder = totalMax % validCount;

    const drafts = Array.from({ length: validCount }).map((_, index) => ({
      name: `Orang ${index + 1}`,
      maxPhotos: index === 0 ? perPersonQuota + remainder : perPersonQuota,
    }));

    setSubTokenDrafts(drafts);
  }, []);

  useEffect(() => {
    if (project && isOpen) {
      if (project.subTokens && project.subTokens.length > 0) {
        setActiveTab('view');
      } else {
        setActiveTab('create');
        generateDrafts(2, project.maxPhotos);
      }
    }
  }, [project, isOpen, generateDrafts]);

  if (!isOpen || !project) return null;

  const handleCountChange = (count: number) => {
    setNumPeople(count);
    generateDrafts(count, project.maxPhotos);
  };

  const handleDraftNameChange = (index: number, name: string) => {
    const updated = [...subTokenDrafts];
    updated[index].name = name;
    setSubTokenDrafts(updated);
  };

  const handleDraftQuotaChange = (index: number, quota: number) => {
    const updated = [...subTokenDrafts];
    updated[index].maxPhotos = Math.max(1, quota);
    setSubTokenDrafts(updated);
  };

  const handleSaveSubTokens = async () => {
    setIsSaving(true);
    try {
      const generatedSubTokens: SubToken[] = subTokenDrafts.map((draft, idx) => ({
        id: `tok_${Math.random().toString(36).substring(2, 9)}_${idx + 1}`,
        name: draft.name.trim() || `Orang ${idx + 1}`,
        maxPhotos: draft.maxPhotos,
        selectedPhotoIds: [],
        status: 'Menunggu Pemilihan',
      }));

      await updateDoc(doc(db, "projects", project.id), {
        subTokens: generatedSubTokens,
      });

      try {
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Pembagian Token Link", `Membagi kuota ${project.maxPhotos} foto menjadi ${generatedSubTokens.length} link untuk klien ${project.clientName}`);
      } catch (e) {}

      if (onProjectUpdated) onProjectUpdated();
      setActiveTab('view');
      alert(`Berhasil membagi ${generatedSubTokens.length} token link!`);
    } catch (err: any) {
      console.error("Gagal menyimpan sub-token:", err);
      alert("Gagal menyimpan pembagian token link: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSubTokens = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus pembagian token link dan kembali ke 1 link utama?")) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "projects", project.id), {
        subTokens: [],
      });
      if (onProjectUpdated) onProjectUpdated();
      generateDrafts(2, project.maxPhotos);
      setActiveTab('create');
    } catch (e: any) {
      alert("Gagal menghapus sub-token: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getSubTokenUrl = (tokenId: string) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/client/${project.id}?token=${tokenId}`;
  };

  const handleCopy = (tokenId: string) => {
    const url = getSubTokenUrl(tokenId);
    navigator.clipboard.writeText(url);
    setCopiedId(tokenId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareWhatsApp = (subToken?: SubToken) => {
    let cleanNumber = project.waNumber.replace(/[^0-9]/g, "");
    if (cleanNumber.startsWith("0")) cleanNumber = "62" + cleanNumber.substring(1);

    let message = "";
    if (subToken) {
      message = `Halo ${subToken.name} (${project.clientName}),\n\nBerikut link galeri foto khusus Anda untuk memilih hingga ${subToken.maxPhotos} foto:\n${getSubTokenUrl(subToken.id)}\n\nTerima kasih,\nZeey Studio`;
    } else if (project.subTokens && project.subTokens.length > 0) {
      message = `Halo ${project.clientName},\n\nBerikut link pemilihan foto untuk ${project.subTokens.length} orang (Total kuota: ${project.maxPhotos} foto):\n\n`;
      project.subTokens.forEach((st, idx) => {
        message += `${idx + 1}. ${st.name} (Kuota: ${st.maxPhotos} foto):\n${getSubTokenUrl(st.id)}\n\n`;
      });
      message += `Silakan buka link sesuai nama masing-masing untuk memilih foto. Terima kasih!\nZeey Studio`;
    }

    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  const totalAllocated = subTokenDrafts.reduce((acc, curr) => acc + (curr.maxPhotos || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl space-y-6 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-accent/10 text-accent font-semibold text-xs px-2.5 py-1 rounded-full border border-accent/20">
                Fitur Multi-Token
              </span>
              <h2 className="text-xl md:text-2xl font-serif text-foreground">Pembagian Token Link Foto</h2>
            </div>
            <p className="text-sm text-foreground/60 mt-1 font-sans">
              Klien: <strong className="text-foreground">{project.clientName}</strong> &bull; Total Kuota Paket: <strong className="text-accent">{project.maxPhotos} Foto</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground p-1 rounded-lg hover:bg-surface-alt transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Selector */}
        {project.subTokens && project.subTokens.length > 0 && (
          <div className="flex bg-surface-alt p-1 rounded-xl border border-border shrink-0 font-sans text-xs md:text-sm">
            <button
              onClick={() => setActiveTab('view')}
              className={`flex-1 py-2 rounded-lg font-medium transition-all ${activeTab === 'view' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'}`}
            >
              Daftar Link ({project.subTokens.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2 rounded-lg font-medium transition-all ${activeTab === 'create' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground'}`}
            >
              + Atur Ulang Pembagian
            </button>
          </div>
        )}

        {/* Tab 1: View Sub-tokens */}
        {activeTab === 'view' && project.subTokens && project.subTokens.length > 0 && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1 font-sans">
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-2xl text-xs md:text-sm flex justify-between items-center gap-2">
              <div>
                <strong>{project.subTokens.length} Token Link Aktif</strong>
                <p className="text-blue-600 text-xs mt-0.5">Setiap orang memiliki batas foto sendiri yang terisolasi.</p>
              </div>
              <button
                onClick={() => handleShareWhatsApp()}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1 shadow-sm transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                Kirim Semua Link WA
              </button>
            </div>

            <div className="space-y-3">
              {project.subTokens.map((st, idx) => {
                const selectedCount = st.selectedPhotoIds ? st.selectedPhotoIds.length : 0;
                const isDone = st.status === 'Selesai' || selectedCount >= st.maxPhotos;

                return (
                  <div
                    key={st.id}
                    className="p-4 rounded-2xl border border-border bg-surface-alt/40 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-accent/30 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="font-semibold text-foreground text-sm">{st.name}</h4>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                            isDone ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isDone ? '✓ Selesai' : 'Belum Memilih'}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/60">
                        Kuota foto: <strong className="text-foreground">{st.maxPhotos} foto</strong> &bull; Terpilih: <strong className="text-accent">{selectedCount} foto</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(st.id)}
                        className="flex-1 md:flex-none px-3 py-1.5 border border-border bg-background rounded-xl text-xs font-medium hover:bg-surface-alt transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {copiedId === st.id ? (
                          <span className="text-green-600 font-semibold">Tersalin ✓</span>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                            Salin Link
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(st)}
                        className="px-3 py-1.5 bg-green-100 text-green-700 border border-green-200 rounded-xl text-xs font-medium hover:bg-green-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Kirim ke WhatsApp Klien"
                      >
                        WA
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-border flex justify-between items-center">
              <button
                onClick={handleResetSubTokens}
                disabled={isSaving}
                className="text-xs text-red-600 hover:text-red-700 underline font-medium cursor-pointer"
              >
                Hapus Pembagian (Kembali 1 Link Utama)
              </button>
              <button
                onClick={onClose}
                className="bg-surface-alt border border-border text-foreground px-5 py-2 rounded-xl text-xs font-medium hover:bg-border transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Create / Configure Sub-tokens */}
        {activeTab === 'create' && (
          <div className="space-y-5 overflow-y-auto pr-1 flex-1 font-sans">
            <div className="space-y-2 bg-surface-alt/50 p-4 rounded-2xl border border-border">
              <label className="block text-xs font-semibold text-foreground/80">
                Bagikan ke Berapa Orang / Link?
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={numPeople}
                  onChange={(e) => handleCountChange(Number(e.target.value))}
                  className="w-24 p-2.5 border border-border rounded-xl bg-background font-semibold text-center focus:outline-none focus:border-accent"
                />
                <span className="text-xs text-foreground/60">
                  Orang (Total Kuota Paket: <strong className="text-foreground">{project.maxPhotos} Foto</strong>)
                </span>
              </div>
            </div>

            {/* List of link drafts */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold text-foreground/70 px-1">
                <span>Rincian Pembagian Link</span>
                <span className={totalAllocated > project.maxPhotos ? "text-red-500 font-bold" : "text-emerald-600"}>
                  Total Alokasi: {totalAllocated} / {project.maxPhotos} Foto
                </span>
              </div>

              {subTokenDrafts.map((draft, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl border border-border bg-background flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-accent/10 text-accent font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-foreground/50 font-medium block">Nama / Label Link</label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => handleDraftNameChange(idx, e.target.value)}
                      placeholder={`Orang ${idx + 1}`}
                      className="w-full p-2 border border-border rounded-lg bg-surface-alt/50 text-xs focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="w-28 space-y-1">
                    <label className="text-[10px] text-foreground/50 font-medium block">Kuota Foto</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={draft.maxPhotos}
                        onChange={(e) => handleDraftQuotaChange(idx, Number(e.target.value))}
                        className="w-full p-2 border border-border rounded-lg bg-surface-alt/50 text-xs text-center font-semibold focus:outline-none focus:border-accent"
                      />
                      <span className="text-xs text-foreground/50">foto</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalAllocated > project.maxPhotos && (
              <p className="text-xs text-red-500 font-medium bg-red-50 p-2.5 rounded-xl border border-red-200">
                ⚠️ Peringatan: Total alokasi kuota ({totalAllocated} foto) melebihi batas total paket ({project.maxPhotos} foto).
              </p>
            )}

            <div className="pt-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 border border-border rounded-xl text-xs font-medium hover:bg-surface-alt transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveSubTokens}
                disabled={isSaving || subTokenDrafts.length === 0}
                className="px-6 py-2.5 bg-accent hover:bg-accent-dark text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? "Menyimpan..." : `Simpan & Buat ${subTokenDrafts.length} Link`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
