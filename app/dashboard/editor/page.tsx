"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { db } from "@/lib/firebase";
import { collection, getDocs, updateDoc, doc, query, orderBy } from "firebase/firestore";
import Link from "next/link";

type EditorRequest = {
  id: string;
  projectId: string;
  clientName: string;
  notes: string;
  status: "Pending" | "In Progress" | "Selesai";
  createdAt: string;
};

export default function EditorDashboard() {
  const [requests, setRequests] = useState<EditorRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "editor_requests"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const reqList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EditorRequest));
      setRequests(reqList);
    } catch (error) {
      console.error("Error fetching editor requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string, projectId?: string) => {
    try {
      await updateDoc(doc(db, "editor_requests", id), {
        status: newStatus
      });

      const { logActivity } = await import("@/lib/audit");
      await logActivity("Tugas Editor", `Mengubah status tugas editor ID ${id} menjadi ${newStatus}`);

      if (newStatus === "Selesai" && projectId) {
        const { getDoc } = await import("firebase/firestore");
        const projectDoc = await getDoc(doc(db, "projects", projectId));
        const project = projectDoc.exists() ? projectDoc.data() : null;

        const integrationDoc = await getDoc(doc(db, "settings", "integration"));
        const integration = integrationDoc.exists() ? integrationDoc.data() : null;

        if (project && project.waNumber && integration?.fonnteToken) {
          const message = `Halo ${project.clientName},\n\nTim Editor kami telah selesai memproses foto pilihan Anda!\nSilakan cek hasil editnya di galeri Anda:\n${window.location.origin}/client/${projectId}\n\nTerima kasih,\nZeey Studio`;

          fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              waNumber: project.waNumber,
              message,
              fonnteToken: integration.fonnteToken
            })
          }).catch(err => console.error("Gagal mengirim WA:", err));
        }
      }

      fetchRequests();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Gagal mengupdate status tugas.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return <span className="px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-medium">Menunggu</span>;
      case "In Progress":
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">Sedang Dikerjakan</span>;
      case "Selesai":
        return <span className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-medium">Selesai</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  return (
    <Sidebar>
      <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full pb-24 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border/50 pb-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif flex items-center gap-3">
              <span className="bg-purple-100 text-purple-600 p-2 rounded-xl">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                </svg>
              </span>
              Tugas Editor
            </h1>
            <p className="text-foreground/60 font-sans text-sm md:text-base">Kelola daftar request editing dari klien.</p>
          </div>
          <button 
            onClick={fetchRequests}
            className="flex items-center gap-2 text-sm bg-surface-alt hover:bg-surface border border-border px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-foreground/50 font-sans animate-pulse">Memuat daftar tugas...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20 bg-surface border border-dashed border-border rounded-3xl">
            <div className="w-20 h-20 bg-purple-50 text-purple-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <h3 className="text-2xl font-serif text-foreground mb-2">Belum ada request.</h3>
            <p className="text-foreground/60 font-sans max-w-md mx-auto">
              Saat ini belum ada permintaan editing dari klien. Request baru akan muncul di sini secara otomatis.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {requests.map((req) => (
              <div key={req.id} className="bg-surface border border-border rounded-3xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                <div className="p-6 border-b border-border/50 bg-surface-alt/30 flex justify-between items-start">
                  <div>
                    <h3 className="font-serif text-lg text-foreground mb-1">{req.clientName}</h3>
                    <p className="text-xs text-foreground/50 font-sans font-mono">{new Date(req.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
                
                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-6 flex-1">
                    <p className="text-xs text-foreground/50 font-bold uppercase tracking-widest mb-2">Catatan Klien</p>
                    <div className="bg-background border border-border rounded-xl p-4 text-sm font-sans text-foreground/80 h-32 overflow-y-auto">
                      {req.notes ? req.notes : <span className="italic text-foreground/40">Tidak ada catatan khusus.</span>}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-auto">
                    {req.status === "Pending" && (
                      <button 
                        onClick={() => updateStatus(req.id, "In Progress")}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                      >
                        Kerjakan
                      </button>
                    )}
                    {req.status === "In Progress" && (
                      <button 
                        onClick={() => updateStatus(req.id, "Selesai", req.projectId)}
                        className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm cursor-pointer"
                      >
                        Tandai Selesai
                      </button>
                    )}
                    <Link 
                      href={`/client/${req.projectId}`}
                      target="_blank"
                      className="py-2.5 px-4 bg-surface-alt border border-border text-foreground rounded-lg text-sm font-medium hover:bg-surface transition-colors flex items-center justify-center cursor-pointer"
                      title="Lihat Galeri Klien"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sidebar>
  );
}
