"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  gdriveLink: string;
  maxPhotos: number;
  createdAt: string;
};

type Admin = {
  id: string;
  name: string;
  role: string;
  status: "Aktif" | "Tidak Aktif";
};

export default function OwnerPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([
    { id: "1", name: "Sarah Connor", role: "Admin Senior", status: "Aktif" },
    { id: "2", name: "John Doe", role: "Admin Junior", status: "Aktif" },
    { id: "3", name: "Jane Smith", role: "Admin", status: "Tidak Aktif" },
  ]);

  // Read projects from localStorage
  useEffect(() => {
    const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
    setProjects(savedProjects);
  }, []);

  // Calculate mock "Photos Selected" (assuming 80% limit reached for demo)
  const totalPhotosSelected = projects.reduce((acc, proj) => acc + Math.floor(proj.maxPhotos * 0.8), 0);

  return (
    <div className="min-h-screen bg-background p-8 md:p-12 lg:p-24 flex flex-col items-center">
      <div className="max-w-5xl w-full">
        <div className="flex justify-between items-end mb-10 border-b border-border pb-6">
          <div>
            <h1 className="text-4xl text-foreground mb-2">Portal Owner</h1>
            <p className="text-foreground/70 font-sans">Dasbor pemantauan & manajemen</p>
          </div>
          <div className="flex gap-4">
            <Link 
              href="/admin" 
              className="px-6 py-2 bg-surface border border-border rounded-lg text-sm hover:bg-surface-alt transition-colors"
            >
              Ke Portal Admin
            </Link>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-surface border border-border p-8 rounded-xl shadow-sm flex flex-col items-center justify-center text-center">
            <p className="text-sm text-foreground/60 font-sans uppercase tracking-widest mb-2">Total Project</p>
            <h2 className="text-6xl text-terracotta">{projects.length}</h2>
            <p className="text-sm text-foreground/50 mt-4">Dibuat sepanjang waktu</p>
          </div>
          <div className="bg-surface border border-border p-8 rounded-xl shadow-sm flex flex-col items-center justify-center text-center">
            <p className="text-sm text-foreground/60 font-sans uppercase tracking-widest mb-2">Foto Terpilih</p>
            <h2 className="text-6xl text-foreground">{totalPhotosSelected}</h2>
            <p className="text-sm text-foreground/50 mt-4">Bulan Ini (Data Simulasi)</p>
          </div>
        </div>

        {/* Admin CRUD Table Simulation */}
        <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h2 className="text-xl">Manajemen Admin</h2>
            <button className="text-sm bg-foreground text-surface px-4 py-2 rounded-lg hover:bg-black transition-colors cursor-pointer">
              + Tambah Admin
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans">
              <thead className="bg-surface-alt/50 text-sm text-foreground/70 border-b border-border">
                <tr>
                  <th className="p-4 font-medium">Nama Admin</th>
                  <th className="p-4 font-medium">Peran</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-surface-alt/20 transition-colors">
                    <td className="p-4 font-medium">{admin.name}</td>
                    <td className="p-4 text-foreground/70">{admin.role}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs ${admin.status === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {admin.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button className="text-sm text-terracotta hover:text-terracotta-dark mr-4 cursor-pointer">Edit</button>
                      <button className="text-sm text-foreground/50 hover:text-red-500 cursor-pointer">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
