"use client";

import Sidebar from "@/components/Sidebar";

export default function SchedulePage() {
  return (
    <Sidebar>
      <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="mb-10 border-b border-border pb-6">
          <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Jadwal Pemotretan</h1>
          <p className="text-foreground/70 font-sans">Lihat dan kelola jadwal sesi foto studio.</p>
        </div>
        
        <div className="bg-surface border border-border rounded-2xl shadow-md p-8 animate-in fade-in slide-in-from-bottom-2">
          <div className="text-center text-foreground/50 py-10 font-sans">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>Fitur Kalender Jadwal Pemotretan akan segera hadir.</p>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
