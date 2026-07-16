"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

export default function AuditLogPage() {
  const router = useRouter();
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem("zeey_auth_role");
    if (role !== "owner") {
      router.push("/dashboard");
      return;
    }

    const loadAuditLogs = async () => {
      try {
        const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(100));
        const logSnap = await getDocs(q);
        setAuditLogs(logSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error loading audit logs", e);
      } finally {
        setIsAuditLoading(false);
      }
    };
    loadAuditLogs();
  }, [router]);

  return (
    <Sidebar>
      <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full pb-24 animate-in fade-in duration-500">
        <div className="mb-8 border-b border-border/50 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Riwayat Aktivitas Sistem</h1>
            <p className="text-foreground/70 font-sans text-sm md:text-base">
              Pantau semua aktivitas yang dilakukan oleh admin dan owner secara real-time.
            </p>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
          {isAuditLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-alt border-b border-border text-foreground/70 text-sm">
                    <th className="p-4 font-medium whitespace-nowrap">Waktu</th>
                    <th className="p-4 font-medium whitespace-nowrap">Pengguna</th>
                    <th className="p-4 font-medium whitespace-nowrap">Aksi</th>
                    <th className="p-4 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-surface-alt/50 transition-colors">
                      <td className="p-4 text-foreground/70 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.user}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full uppercase tracking-wide font-medium">
                            {log.role}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 font-medium text-foreground/80">{log.action}</td>
                      <td className="p-4 text-foreground/70 leading-relaxed">{log.details}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-foreground/50">
                        Belum ada riwayat aktivitas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
