"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { BentoCard, Field, Icon, INPUT, PageHeader, StatCard } from "@/components/ui";

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import { projectRevenue, revenueDate, monthKey, type RevenueProject } from "@/lib/revenue";

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
};

type Project = RevenueProject & {
  id: string;
  status: string;
  createdAt: string;
};

/** Ikon & warna tiap kategori pengeluaran. */
const KATEGORI: Record<string, { icon: string; tint: string }> = {
  Operasional: { icon: "M13 10V3L4 14h7v7l9-11h-7z", tint: "bg-amber-500/12 text-amber-600 dark:text-amber-400" },
  "Sewa Tempat": { icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", tint: "bg-sky-500/12 text-sky-600 dark:text-sky-400" },
  "Komisi Tim": { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", tint: "bg-violet-500/12 text-violet-600 dark:text-violet-400" },
  "Perawatan Alat": { icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z", tint: "bg-slate-500/12 text-slate-600 dark:text-slate-300" },
  Pemasaran: { icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z", tint: "bg-pink-500/12 text-pink-600 dark:text-pink-400" },
  Lainnya: { icon: "M4 6h16M4 12h16M4 18h7", tint: "bg-foreground/8 text-foreground/60" },
};

export default function FinancePage() {
  const router = useRouter();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Operasional");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("zeey_auth_role");
    if (role !== "owner") {
      router.push("/dashboard");
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load expenses
      const expenseSnap = await getDocs(query(collection(db, "expenses"), orderBy("date", "desc")));
      const expensesData = expenseSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
      setExpenses(expensesData);

      // Load revenue (projects)
      const projectSnap = await getDocs(collection(db, "projects"));
      const projectsData = projectSnap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      setProjects(projectsData);
    } catch (e) {
      console.error("Error loading finance data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const amountNum = parseInt(amount.replace(/[^0-9]/g, "")) || 0;
      await addDoc(collection(db, "expenses"), {
        description,
        amount: amountNum,
        category,
        date: expenseDate,
        createdAt: new Date().toISOString()
      });
      
      const { logActivity } = await import("@/lib/audit");
      await logActivity("Keuangan", `Menambahkan pengeluaran baru: ${description} (Rp ${amountNum.toLocaleString('id-ID')})`);

      setDescription("");
      setAmount("");
      setCategory("Operasional");
      loadData();
    } catch (err) {
      console.error(err);
      alert("Gagal menambahkan pengeluaran.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, desc: string) => {
    if (confirm("Hapus catatan pengeluaran ini?")) {
      try {
        await deleteDoc(doc(db, "expenses", id));
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Keuangan", `Menghapus pengeluaran: ${desc}`);
        loadData();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // --- Calculate Analytics ---
  // Rumus seragam dengan Dasbor: lunas = paket + tambahan, belum lunas = DP (lib/revenue.ts)
  const totalRevenue = projects.reduce((sum, p) => sum + projectRevenue(p), 0);

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpense;

  // Chart Data preparation (Monthly)
  const monthlyDataMap: Record<string, { month: string, Pemasukan: number, Pengeluaran: number, Laba: number, sortKey: string }> = {};

  // Map revenues (dikelompokkan menurut tanggal pelunasan)
  projects.forEach(p => {
    const amount = projectRevenue(p);
    if (amount > 0) {
      const date = revenueDate(p);
      const key = monthKey(date);
      const monthLabel = date.toLocaleString("id-ID", { month: "short", year: "numeric" });

      if (!monthlyDataMap[key]) {
        monthlyDataMap[key] = { month: monthLabel, Pemasukan: 0, Pengeluaran: 0, Laba: 0, sortKey: key };
      }
      monthlyDataMap[key].Pemasukan += amount;
    }
  });

  // Map expenses
  expenses.forEach(e => {
    if (e.date) {
      const date = new Date(e.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleString("id-ID", { month: "short", year: "numeric" });

      if (!monthlyDataMap[key]) {
        monthlyDataMap[key] = { month: monthLabel, Pemasukan: 0, Pengeluaran: 0, Laba: 0, sortKey: key };
      }
      monthlyDataMap[key].Pengeluaran += e.amount;
    }
  });

  const chartData = Object.values(monthlyDataMap)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(data => ({
      ...data,
      Laba: data.Pemasukan - data.Pengeluaran
    }));

  return (
    <Sidebar>
      <div className="p-3.5 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-8">
        <PageHeader module="finance" title="Keuangan & Bisnis" subtitle="Pantau arus kas, laba rugi, dan catat pengeluaran operasional studio." />

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
             <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-5 md:space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 stagger">
              <StatCard label="Pemasukan" value={totalRevenue} format={rupiah} hint="Total pendapatan" tone="emerald" icon="M7 11l5-5m0 0l5 5m-5-5v12" />
              <StatCard label="Pengeluaran" value={totalExpense} format={rupiah} hint="Biaya operasional" tone="pink" icon="M17 13l-5 5m0 0l-5-5m5 5V6" />
              <div className="col-span-2 md:col-span-1">
                {/* Saat rugi, jangan pakai kartu sorotan — angka merugi tidak boleh tampak seperti pencapaian */}
                {netProfit >= 0 ? (
                  <StatCard highlight label="Laba Bersih" value={netProfit} format={rupiah} hint="Pemasukan − pengeluaran" icon="M3 17l6-6 4 4 8-8m0 0v6m0-6h-6" />
                ) : (
                  <StatCard
                    label="Rugi Bersih"
                    value={Math.abs(netProfit)}
                    format={(n) => `− ${rupiah(n)}`}
                    hint="Pengeluaran melebihi pemasukan"
                    tone="pink"
                    icon="M3 7l6 6 4-4 8 8m0 0v-6m0 6h-6"
                  />
                )}
              </div>
            </div>

            {/* Charts */}
            <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
              <h2 className="text-base md:text-lg font-bold tracking-tight mb-6">Grafik Laba/Rugi Bulanan</h2>
              {chartData.length > 0 ? (
                <div className="h-64 md:h-80 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="finIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#10b981" /></linearGradient>
                        <linearGradient id="finOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor="#ec4899" /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }} dy={8} />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        width={44}
                        tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }}
                        tickFormatter={(value) => `${(value/1000000).toFixed(1)}jt`} 
                      />
                      <Tooltip 
                        formatter={(value) => [`Rp ${Number(value).toLocaleString("id-ID")}`, ""]}
                        cursor={{ fill: 'rgba(99,102,241,0.08)', radius: 8 }}
                        contentStyle={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 12 }}
                      />
                      <Legend iconType="circle" />
                      <Bar dataKey="Pemasukan" fill="url(#finIn)" radius={[8, 8, 8, 8]} maxBarSize={22} animationDuration={1000} />
                      <Bar dataKey="Pengeluaran" fill="url(#finOut)" radius={[8, 8, 8, 8]} maxBarSize={22} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-foreground/40 font-sans">
                  Belum ada data keuangan yang cukup untuk menampilkan grafik.
                </div>
              )}
            </div>

            {/* ── Catat pengeluaran & buku kas ───────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start stagger">
              <BentoCard
                tone="from-pink-500 to-rose-500"
                glow="shadow-pink-500/30"
                icon="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                title="Catat Pengeluaran"
                desc="Tambah biaya operasional"
              >
                <form onSubmit={handleAddExpense} className="space-y-3.5">
                  <Field label="Tanggal">
                    <input type="date" required value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className={INPUT} />
                  </Field>
                  <Field label="Kategori">
                    <select value={category} onChange={e => setCategory(e.target.value)} className={`${INPUT} appearance-none cursor-pointer`}>
                      <option value="Operasional">Operasional (Listrik, Internet, dll)</option>
                      <option value="Sewa Tempat">Sewa Tempat</option>
                      <option value="Komisi Tim">Komisi Tim / Gaji</option>
                      <option value="Perawatan Alat">Perawatan & Pembelian Alat</option>
                      <option value="Pemasaran">Pemasaran & Iklan</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </Field>
                  <Field label="Deskripsi">
                    <input type="text" required placeholder="Contoh: Bayar listrik bulan Juli" value={description} onChange={e => setDescription(e.target.value)} className={INPUT} />
                  </Field>
                  <Field label="Jumlah (Rp)">
                    <input type="number" required placeholder="Contoh: 500000" value={amount} onChange={e => setAmount(e.target.value)} className={INPUT} />
                  </Field>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-2xl bg-brand text-white text-sm font-bold shadow-lg shadow-violet-500/30 transition-all hover:brightness-110 disabled:opacity-70 cursor-pointer press"
                  >
                    {isSubmitting ? "Menyimpan…" : "Simpan Pengeluaran"}
                  </button>
                </form>
              </BentoCard>

              <section className="lg:col-span-2 rounded-3xl bg-surface border border-border/70 shadow-sm p-4 md:p-5">
                <header className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                      <Icon d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" className="w-[18px] h-[18px]" strokeWidth={2.2} />
                    </span>
                    <div>
                      <h2 className="text-sm md:text-base font-bold tracking-tight leading-tight">Buku Pengeluaran</h2>
                      <p className="text-[11px] text-foreground/50 leading-tight">{expenses.length} catatan tersimpan</p>
                    </div>
                  </div>
                  {expenses.length > 0 && (
                    <span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 tabular-nums">
                      {rupiah(totalExpense)}
                    </span>
                  )}
                </header>

                {expenses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-foreground/50">
                    Belum ada catatan pengeluaran.
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-[30rem] overflow-y-auto pr-1 hide-scrollbar">
                    {expenses.map((expense) => {
                      const k = KATEGORI[expense.category] || KATEGORI.Lainnya;
                      return (
                        <li key={expense.id} className="group flex items-center gap-3 rounded-2xl bg-surface-alt/50 hover:bg-surface-alt px-3 py-2.5 transition-colors">
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.tint}`}>
                            <Icon d={k.icon} className="w-4 h-4" strokeWidth={2.2} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" title={expense.description}>{expense.description}</p>
                            <p className="text-[11px] text-foreground/50">
                              {expense.category} · {new Date(expense.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">−{rupiah(expense.amount)}</span>
                          <button
                            onClick={() => handleDeleteExpense(expense.id, expense.description)}
                            title="Hapus catatan"
                            className="shrink-0 w-8 h-8 rounded-lg text-foreground/35 hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center cursor-pointer"
                          >
                            <Icon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

          </div>
        )}
      </div>
    </Sidebar>
  );
}
