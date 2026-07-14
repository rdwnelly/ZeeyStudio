import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-5xl md:text-7xl mb-6 font-serif">Zeey Studio</h1>
        <p className="text-lg md:text-xl text-foreground/70 font-sans mb-12 max-w-lg mx-auto">
          Portal Klien & Sistem Manajemen Fotografi. Jelajahi ketiga akses utama di bawah ini.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link 
            href="/owner"
            className="group block p-8 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md hover:border-terracotta transition-all duration-300 text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-terracotta/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <h2 className="text-2xl font-serif mb-2 group-hover:text-terracotta transition-colors relative z-10">Portal Owner</h2>
            <p className="text-sm text-foreground/60 font-sans relative z-10">Dasbor pemantauan kinerja dan manajemen admin.</p>
          </Link>

          <Link 
            href="/admin"
            className="group block p-8 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md hover:border-terracotta transition-all duration-300 text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-terracotta/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <h2 className="text-2xl font-serif mb-2 group-hover:text-terracotta transition-colors relative z-10">Portal Admin</h2>
            <p className="text-sm text-foreground/60 font-sans relative z-10">Buat project klien, atur batas foto, dan hasilkan tautan pilihan foto.</p>
          </Link>

          <Link 
            href="/client/demo"
            className="group md:col-span-2 block p-8 bg-surface border border-border rounded-xl shadow-sm hover:shadow-md hover:border-terracotta transition-all duration-300 text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-terracotta/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
            <h2 className="text-2xl font-serif mb-2 group-hover:text-terracotta transition-colors relative z-10">Galeri Klien (Demo)</h2>
            <p className="text-sm text-foreground/60 font-sans relative z-10">Galeri interaktif untuk memilih foto dengan penghitung waktu-nyata dan pembuatan tagihan otomatis.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
