"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { db, storage } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";

type PortfolioItem = {
  id: string;
  url: string;
  category: string;
  fileName: string;
  createdAt: string;
  uploadedBy: string;
};

const DEFAULT_CATEGORIES = ["Wedding", "Graduation", "Studio Keluarga", "Pas Foto"];

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [activeTab, setActiveTab] = useState<string>("Semua");
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  
  const router = useRouter();

  const loadPortfolio = async () => {
    try {
      const q = query(collection(db, "portfolio"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PortfolioItem));
      setItems(data);
      
      // Update dynamic categories from existing data
      const dynamicCats = new Set(DEFAULT_CATEGORIES);
      data.forEach(item => dynamicCats.add(item.category));
      setCategories(Array.from(dynamicCats));
    } catch (e) {
      console.error("Error loading portfolio:", e);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem("zeey_auth_role");
    if (!role) {
      router.push("/");
      return;
    }
    loadPortfolio();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    const finalCategory = selectedCategory === "Lainnya" && customCategory.trim() !== "" 
      ? customCategory.trim() 
      : selectedCategory;

    setIsUploading(true);
    setUploadProgress(10); // Fake progress to show start

    try {
      // 1. Upload to Storage
      const fileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
      const storageRef = ref(storage, `portfolio/${fileName}`);
      
      setUploadProgress(40);
      await uploadBytes(storageRef, selectedFile);
      
      setUploadProgress(70);
      const url = await getDownloadURL(storageRef);

      // 2. Save to Firestore
      const user = localStorage.getItem("zeey_auth_user") || "Admin";
      
      await addDoc(collection(db, "portfolio"), {
        url,
        category: finalCategory,
        fileName,
        createdAt: new Date().toISOString(),
        uploadedBy: user
      });

      setUploadProgress(100);
      
      // Reset & Reload
      setSelectedFile(null);
      setCustomCategory("");
      setSelectedCategory(DEFAULT_CATEGORIES[0]);
      (document.getElementById("file-upload") as HTMLInputElement).value = "";
      
      loadPortfolio();
    } catch (err: any) {
      console.error(err);
      alert(`Gagal mengunggah gambar: ${err.message}. Pastikan Security Rules Storage Anda diizinkan untuk menulis.`);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleDelete = async (item: PortfolioItem) => {
    if (!confirm(`Hapus foto ini dari galeri?`)) return;

    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "portfolio", item.id));
      
      // Delete from Storage
      const storageRef = ref(storage, `portfolio/${item.fileName}`);
      await deleteObject(storageRef).catch(e => console.warn("File mungkin sudah terhapus di Storage", e));
      
      loadPortfolio();
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus gambar");
    }
  };

  const filteredItems = activeTab === "Semua" ? items : items.filter(i => i.category === activeTab);

  return (
    <Sidebar>
      <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full animate-in fade-in duration-500 pb-24">
        <div className="mb-8 border-b border-border/50 pb-6">
          <h1 className="text-3xl md:text-4xl text-foreground mb-2 font-serif">Galeri Portofolio</h1>
          <p className="text-foreground/70 font-sans text-sm md:text-base">Kelola foto-foto terbaik Anda yang akan ditampilkan di halaman depan (Landing Page).</p>
        </div>

        {/* Upload Section */}
        <div className="bg-surface border border-border p-6 rounded-3xl shadow-sm mb-10">
          <h2 className="text-xl font-serif mb-4">Unggah Karya Baru</h2>
          <form onSubmit={handleUpload} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-1/3">
              <label className="block text-sm font-medium mb-2 text-foreground/80">Pilih Gambar (JPG/PNG)</label>
              <input 
                id="file-upload"
                type="file" 
                accept="image/*"
                required
                onChange={handleFileChange}
                className="w-full p-2 border border-border rounded-xl bg-background text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer"
              />
            </div>
            
            <div className="w-full md:w-1/3">
              <label className="block text-sm font-medium mb-2 text-foreground/80">Kategori</label>
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="Lainnya">Lainnya (Ketik Sendiri)...</option>
              </select>
            </div>

            {selectedCategory === "Lainnya" && (
              <div className="w-full md:w-1/3 animate-in fade-in slide-in-from-left-2">
                <label className="block text-sm font-medium mb-2 text-foreground/80">Kategori Baru</label>
                <input 
                  type="text" 
                  required
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Contoh: Pre-wedding"
                  className="w-full p-3 border border-border rounded-xl bg-background focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
              </div>
            )}

            <div className="w-full md:w-auto mt-4 md:mt-0">
              <button 
                type="submit" 
                disabled={isUploading || !selectedFile}
                className="w-full md:w-auto bg-accent text-white px-8 py-3 rounded-xl font-medium hover:bg-accent-dark transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isUploading ? `Mengunggah... ${uploadProgress}%` : 'Unggah Foto'}
              </button>
            </div>
          </form>
          
          {isUploading && (
            <div className="mt-4 w-full bg-surface-alt rounded-full h-2 overflow-hidden">
              <div className="bg-accent h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          )}
        </div>

        {/* Gallery Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-border/50 pb-1 font-sans overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab("Semua")} 
            className={`px-5 py-2 font-medium text-sm rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === "Semua" ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
          >
            Semua Karya
          </button>
          {categories.map(c => (
            <button 
              key={c}
              onClick={() => setActiveTab(c)} 
              className={`px-5 py-2 font-medium text-sm rounded-t-xl transition-all cursor-pointer whitespace-nowrap ${activeTab === c ? 'bg-surface border-x border-t border-border border-b-0 text-accent -mb-[1px] shadow-[0_-4px_6px_-2px_rgba(0,0,0,0.05)]' : 'text-foreground/60 hover:text-foreground hover:bg-surface-alt'}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        {items.length === 0 ? (
          <div className="text-center p-12 bg-surface-alt/30 rounded-3xl border border-dashed border-border">
            <svg className="w-12 h-12 text-foreground/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <p className="text-foreground/60">Belum ada karya di galeri Anda.</p>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {filteredItems.map(item => (
              <div key={item.id} className="relative group break-inside-avoid rounded-2xl overflow-hidden bg-surface shadow-sm border border-border">
                <img src={item.url} alt={item.fileName} className="w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                  <div className="flex justify-between items-start">
                    <span className="bg-accent text-white text-xs px-2 py-1 rounded-lg font-medium shadow-sm">
                      {item.category}
                    </span>
                    <button 
                      onClick={() => handleDelete(item)}
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-sm transition-colors cursor-pointer"
                      title="Hapus Foto"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                  <div className="text-white text-xs opacity-80">
                    <p>Oleh: {item.uploadedBy}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredItems.length === 0 && (
              <div className="col-span-full p-8 text-center text-foreground/50">
                Tidak ada foto untuk kategori ini.
              </div>
            )}
          </div>
        )}
      </div>
    </Sidebar>
  );
}
