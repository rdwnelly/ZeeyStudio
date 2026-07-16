"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
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

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
};

type Project = {
  id: string;
  status: string;
  packagePrice?: number;
  createdAt: string;
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
  const totalRevenue = projects
    .filter(p => p.status !== "Menunggu Pembayaran" && p.packagePrice)
    .reduce((sum, p) => sum + (p.packagePrice || 0), 0);

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpense;

  // Chart Data preparation (Monthly)
  const monthlyDataMap: Record<string, { month: string, Pemasukan: number, Pengeluaran: number, Laba: number, sortKey: string }> = {};

  // Map revenues
  projects.forEach(p => {
    if (p.status !== "Menunggu Pembayaran" && p.packagePrice && p.createdAt) {
      const date = new Date(p.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleString("id-ID", { month: "short", year: "numeric" });

      if (!monthlyDataMap[key]) {
        monthlyDataMap[key] = { month: monthLabel, Pemasukan: 0, Pengeluaran: 0, Laba: 0, sortKey: key };
      }
      monthlyDataMap[key].Pemasukan += p.packagePrice;
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
      <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full pb-24 animate-in fade-in duration-500">
        <div className="mb-8 border-b border-border/50 pb-6">
          <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Keuangan & Bisnis</h1>
          <p className="text-foreground/70 font-sans text-sm md:text-base">
            Pantau arus kas, laba rugi, dan catat pengeluaran operasional studio.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
             <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                <h3 className="text-foreground/60 font-medium mb-1 font-sans">Total Pemasukan</h3>
                <p className="text-3xl font-serif text-green-600">Rp {totalRevenue.toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                <h3 className="text-foreground/60 font-medium mb-1 font-sans">Total Pengeluaran</h3>
                <p className="text-3xl font-serif text-red-600">Rp {totalExpense.toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                <h3 className="text-foreground/60 font-medium mb-1 font-sans">Laba Bersih (Net Profit)</h3>
                <p className="text-3xl font-serif text-accent">Rp {netProfit.toLocaleString("id-ID")}</p>
              </div>
            </div>

            {/* Charts */}
            <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
              <h2 className="text-xl font-serif mb-6">Grafik Laba/Rugi Bulanan</h2>
              {chartData.length > 0 ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tickFormatter={(value) => `Rp${(value/1000000).toFixed(1)}M`} 
                      />
                      <Tooltip 
                        formatter={(value) => [`Rp ${Number(value).toLocaleString("id-ID")}`, ""]}
                        cursor={{fill: 'rgba(0,0,0,0.05)'}}
                      />
                      <Legend iconType="circle" />
                      <Bar dataKey="Pemasukan" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-foreground/40 font-sans">
                  Belum ada data keuangan yang cukup untuk menampilkan grafik.
                </div>
              )}
            </div>

            {/* Expenses Book */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add Form */}
              <div className="lg:col-span-1 bg-surface border border-border p-6 rounded-2xl shadow-sm">
                <h2 className="text-xl font-serif mb-6 border-b border-border/50 pb-4">Catat Pengeluaran</h2>
                <form onSubmit={handleAddExpense} className="space-y-4 font-sans">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tanggal</label>
                    <input 
                      type="date" 
                      required
                      value={expenseDate}
                      onChange={e => setExpenseDate(e.target.value)}
                      className="w-full p-3 border border-border rounded-xl focus:outline-none focus:border-accent bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Kategori</label>
                    <select 
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full p-3 border border-border rounded-xl focus:outline-none focus:border-accent bg-background"
                    >
                      <option value="Operasional">Operasional (Listrik, Internet, dll)</option>
                      <option value="Sewa Tempat">Sewa Tempat</option>
                      <option value="Komisi Tim">Komisi Tim / Gaji</option>
                      <option value="Perawatan Alat">Perawatan & Pembelian Alat</option>
                      <option value="Pemasaran">Pemasaran & Iklan</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Deskripsi</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g., Bayar Listrik Bulan Juli"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full p-3 border border-border rounded-xl focus:outline-none focus:border-accent bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Jumlah (Rp)</label>
                    <input 
                      type="number" 
                      required
                      placeholder="e.g., 500000"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full p-3 border border-border rounded-xl focus:outline-none focus:border-accent bg-background"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-accent text-white py-3 rounded-xl font-medium hover:bg-accent-dark transition-all cursor-pointer shadow-sm mt-2 disabled:opacity-70"
                  >
                    {isSubmitting ? "Menyimpan..." : "Simpan Pengeluaran"}
                  </button>
                </form>
              </div>

              {/* Expenses List */}
              <div className="lg:col-span-2 bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b border-border/50">
                  <h2 className="text-xl font-serif">Buku Pengeluaran</h2>
                </div>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-alt border-b border-border text-foreground/70 text-sm font-sans">
                        <th className="p-4 font-medium whitespace-nowrap">Tanggal</th>
                        <th className="p-4 font-medium">Kategori</th>
                        <th className="p-4 font-medium">Deskripsi</th>
                        <th className="p-4 font-medium">Jumlah</th>
                        <th className="p-4 font-medium text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-sans">
                      {expenses.map((expense) => (
                        <tr key={expense.id} className="border-b border-border/50 hover:bg-surface-alt/50 transition-colors">
                          <td className="p-4 text-foreground/70 whitespace-nowrap">
                            {new Date(expense.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-surface-alt border border-border rounded-lg text-xs font-medium">
                              {expense.category}
                            </span>
                          </td>
                          <td className="p-4 font-medium text-foreground/80">{expense.description}</td>
                          <td className="p-4 text-red-600 font-medium whitespace-nowrap">Rp {expense.amount.toLocaleString("id-ID")}</td>
                          <td className="p-4 text-center">
                            <button 
                              onClick={() => handleDeleteExpense(expense.id, expense.description)}
                              className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {expenses.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-10 text-center text-foreground/50">
                            Belum ada catatan pengeluaran.
                          </td>
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
    </Sidebar>
  );
}
