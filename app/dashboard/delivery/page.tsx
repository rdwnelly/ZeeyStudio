"use client";

import Sidebar from "@/components/Sidebar";
import Link from "next/link";

export default function DeliveryPage() {
  return (
    <Sidebar>
      <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="mb-10 border-b border-border pb-6">
          <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Pengiriman Hasil Foto</h1>
          <p className="text-foreground/70 font-sans">Unggah link Google Drive foto ke klien yang sudah selesai sesi.</p>
        </div>
        
        <div className="bg-surface border border-border rounded-2xl shadow-md p-8 animate-in fade-in slide-in-from-bottom-2">
          <div className="text-center text-foreground/50 py-6 font-sans">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="mb-4">Untuk sementara, pembuatan link portal pemilihan foto klien masih menggunakan halaman <strong>Buat Project Baru</strong>.</p>
            <Link href="/dashboard/create" className="inline-block bg-accent text-white px-6 py-2 rounded-lg font-medium hover:bg-accent-dark transition-colors cursor-pointer">
              Buka Halaman Buat Project
            </Link>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
