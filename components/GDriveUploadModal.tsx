"use client";

import { useState } from "react";
import { formatGDriveUrl } from "@/lib/drive-utils";

type GDriveUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    clientName: string;
    gdriveFolderId?: string;
    gdriveLinkHighRes?: string;
  } | null;
  onProjectUpdated?: (updatedProject: any) => void;
};

export default function GDriveUploadModal({
  isOpen,
  onClose,
  project,
  onProjectUpdated,
}: GDriveUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  if (!isOpen || !project) return null;

  const handleOpenDriveTab = () => {
    // 1. Extract raw link or ID
    const rawTarget = project.gdriveFolderId || project.gdriveLinkHighRes || "";
    
    if (rawTarget && !rawTarget.includes("@")) {
      const formattedUrl = formatGDriveUrl(rawTarget);
      if (formattedUrl) {
        window.open(formattedUrl, "_blank");
        return;
      }
    }

    // 2. Folder does not exist yet: Auto-create folder via API
    handleCreateFolderAuto();
  };

  const handleCreateFolderAuto = async () => {
    const newTab = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    setIsCreatingFolder(true);
    setStatusMsg({ type: 'info', text: 'Membuat folder di Google Drive...' });
    try {
      const res = await fetch('/api/drive/create-project-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: project.clientName })
      });
      const data = await res.json();
      if (data.success && data.folderId) {
        const link = `https://drive.google.com/drive/folders/${data.folderId}`;
        const { updateDoc, doc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        
        await updateDoc(doc(db, "projects", project.id), {
          gdriveLinkHighRes: link,
          gdriveFolderId: data.folderId
        });

        const updated = { ...project, gdriveLinkHighRes: link, gdriveFolderId: data.folderId };
        if (onProjectUpdated) onProjectUpdated(updated);
        
        setStatusMsg({ type: 'success', text: `Folder berhasil dibuat di Google Drive!` });
        if (newTab) newTab.location.href = link;
      } else {
        if (newTab) newTab.close();
        setStatusMsg({ type: 'error', text: data.error || 'Gagal membuat folder Google Drive.' });
      }
    } catch (err: any) {
      console.error(err);
      if (newTab) newTab.close();
      setStatusMsg({ type: 'error', text: 'Gagal membuat folder Google Drive.' });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    if (!project.gdriveFolderId) {
      alert("Folder Google Drive belum tersedia. Silakan klik 'Buat Folder' terlebih dahulu.");
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });
    setStatusMsg({ type: 'info', text: `Mengunggah ${selectedFiles.length} foto ke Google Drive...` });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setUploadProgress({ current: i + 1, total: selectedFiles.length });

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderId", project.gdriveFolderId);

        const res = await fetch("/api/drive/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        failCount++;
      }
    }

    setIsUploading(false);
    setSelectedFiles([]);
    
    if (failCount === 0) {
      setStatusMsg({ type: "success", text: `Berhasil mengunggah ${successCount} foto ke Google Drive!` });
    } else {
      setStatusMsg({ type: "error", text: `${successCount} foto berhasil, ${failCount} foto gagal diunggah.` });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-border mb-4">
          <div>
            <h3 className="font-serif text-xl text-foreground font-semibold flex items-center gap-2">
              <span className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              </span>
              Upload Foto GDrive
            </h3>
            <p className="text-xs text-foreground/60 mt-1">Klien: {project.clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground p-2 rounded-full hover:bg-surface-alt transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Status Alert Message */}
        {statusMsg && (
          <div className={`p-3.5 rounded-xl text-xs font-medium mb-4 flex items-center gap-2 ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
            statusMsg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Action 1: Open Direct Tab in GDrive */}
          <div className="bg-surface-alt/40 border border-border rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Folder Google Drive Klien</p>
              <p className="text-xs text-foreground/60">Buka langsung di Google Drive atau buat folder otomatis</p>
            </div>
            <div>
              {project.gdriveFolderId || project.gdriveLinkHighRes ? (
                <button
                  type="button"
                  onClick={handleOpenDriveTab}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  Buka Tab
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateFolderAuto}
                  disabled={isCreatingFolder}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {isCreatingFolder ? "Membuat..." : "Buat Folder"}
                </button>
              )}
            </div>
          </div>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink-0 mx-3 text-foreground/40 text-[10px] font-bold tracking-widest uppercase">Atau Upload Langsung Dari Sini</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          {/* Action 2: Direct Batch File Upload */}
          <div className="space-y-3">
            <label className="block border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 transition-all rounded-2xl p-6 text-center cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />
              <div className="flex flex-col items-center gap-2">
                <div className="bg-accent/10 text-accent p-3 rounded-full">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <span className="text-sm font-semibold text-foreground">Klik atau Tarik Foto Ke Sini</span>
                <span className="text-xs text-foreground/50">Pilih beberapa foto foto klien (JPG, PNG, WebP)</span>
              </div>
            </label>

            {/* Selected File List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                <div className="flex justify-between items-center text-xs font-semibold text-foreground/70">
                  <span>Daftar Foto ({selectedFiles.length})</span>
                  <button onClick={() => setSelectedFiles([])} className="text-red-500 hover:underline">Hapus Semua</button>
                </div>
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-background border border-border p-2.5 rounded-xl text-xs">
                    <span className="truncate max-w-[200px] text-foreground/80">{file.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground/50">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                      {!isUploading && (
                        <button onClick={() => handleRemoveFile(idx)} className="text-foreground/40 hover:text-red-500">✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="space-y-2 bg-blue-50 border border-blue-200 p-3 rounded-2xl">
                <div className="flex justify-between text-xs font-semibold text-blue-800">
                  <span>Mengunggah foto...</span>
                  <span>{uploadProgress.current} dari {uploadProgress.total}</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2.5 border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-surface-alt transition-colors"
          >
            Tutup
          </button>
          {selectedFiles.length > 0 && (
            <button
              type="button"
              onClick={handleUploadFiles}
              disabled={isUploading}
              className="px-5 py-2.5 bg-accent hover:bg-accent-dark text-white rounded-xl text-xs font-semibold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Mengunggah...
                </>
              ) : (
                `Unggah ${selectedFiles.length} Foto`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
