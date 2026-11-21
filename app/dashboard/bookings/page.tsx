"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Icon, PageHeader, SkeletonBlock, StatCard } from "@/components/ui";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { authFetch } from "@/lib/auth-client";
import { normalizeWaNumber } from "@/lib/phone";
import { collection, query, updateDoc, doc, type QuerySnapshot, type DocumentData } from "firebase/firestore";
import { getDocsFresh } from "@/lib/firestore-fetch";

import MultiTokenModal, { SubToken } from "@/components/MultiTokenModal";
import GDriveUploadModal from "@/components/GDriveUploadModal";

type Project = {
  id: string;
  clientName: string;
  waNumber: string;
  maxPhotos: number;
  subTokens?: SubToken[];
  createdAt: string;
  status: string;
  createdBy: string;
  assignedAdmin?: string;
  shootDate?: string;
  shootTime?: string;
  packageName?: string;
  packagePrice?: number;
  dpAmount?: number;
  gdriveLinkHighRes?: string;
  paymentProofUrl?: string;
  paymentProofStatus?: 'pending' | 'verified' | 'rejected';
  pendingPayment?: { mode?: string; amount?: number; uniqueCode?: number; createdAt?: string };
  selectedPhotoIds?: string[];
  previouslySelectedPhotoIds?: string[];
  isReopened?: boolean;
  reopenedAt?: string;
};

/** Path ikon garis (viewBox 0 0 24 24) yang dipakai halaman ini. */
const ICON = {
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  check: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  cash: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  bolt: "M13 10V3L4 14h7v7l9-11h-7z",
  upload: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  copy: "M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3",
  edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  send: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
  clipboard: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  left: "M15 19l-7-7 7-7",
  right: "M9 5l7 7-7 7",
};

const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-pink-500 to-rose-500",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-purple-500 to-fuchsia-500",
];

/** Logo WhatsApp (ikon isi penuh). */
function WaIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default function BookingsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'aktif' | 'selesai'>('aktif');

  const [userRole, setUserRole] = useState("");
  const [userName, setUserName] = useState("");
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [creatingFolderId, setCreatingFolderId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>({});
  
  // Payment Verification State
  const [verifyingProject, setVerifyingProject] = useState<Project | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Multi Token Link Modal State
  const [multiTokenProject, setMultiTokenProject] = useState<Project | null>(null);
  const [isMultiTokenOpen, setIsMultiTokenOpen] = useState(false);
  const [uploadModalProject, setUploadModalProject] = useState<Project | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);
  const router = useRouter();

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const role = localStorage.getItem("zeey_auth_role") || "";
      const name = localStorage.getItem("zeey_auth_user") || "";
      setUserRole(role);
      setUserName(name);

      // Ubah hasil kueri menjadi daftar yang siap ditampilkan
      const terapkan = (snap: QuerySnapshot<DocumentData>) => {
        const data: Project[] = [];
        snap.forEach((docSnap) => {
          const p = { id: docSnap.id, ...docSnap.data() } as Project;
          // Backward compatibility
          if (!p.status) p.status = 'Menunggu Pemilihan';
          if (p.status === 'Selesai') p.status = 'File Terkirim'; // Map old 'Selesai'
          data.push(p);
        });

        const terlihat = role === 'admin'
          ? data.filter(p => p.assignedAdmin === name || p.createdBy === name)
          : data;

        // Sort list view by shootDate ascending (closest first), fallback to createdAt
        terlihat.sort((a, b) => {
          const timeA = a.shootDate ? new Date(a.shootDate).getTime() : new Date(a.createdAt).getTime();
          const timeB = b.shootDate ? new Date(b.shootDate).getTime() : new Date(b.createdAt).getTime();
          return timeB - timeA; // default descending
        });

        setProjects(terlihat);
      };

      const q = query(collection(db, "projects"));
      // Bila koneksi belum siap, data server menyusul lewat callback di bawah
      const { snapshot, stale } = await getDocsFresh(q, (fresh) => {
        terapkan(fresh);
        setLoadFailed(false);
      });
      setLoadFailed(stale);
      terapkan(snapshot);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovePayment = async (project: Project) => {
    setIsVerifying(true);
    let waTab: Window | null = null;
    if (project.waNumber) {
      waTab = window.open('about:blank', '_blank');
    }

    try {
      await updateDoc(doc(db, "projects", project.id), {
        status: 'Selesai',
        paymentProofStatus: 'verified',
        completedAt: new Date().toISOString()
      });

      const { logActivity } = await import("@/lib/audit");
      await logActivity("Verifikasi Pembayaran", `Memverifikasi pembayaran transfer klien ${project.clientName} (${project.id})`);

      setVerifyingProject(null);
      fetchProjects();

      if (project.waNumber) {
        const phone = normalizeWaNumber(project.waNumber);
        const link = `${window.location.origin}/client/${project.id}`;
        const message = `Halo ${project.clientName},\n\nPembayaran Anda telah berhasil diverifikasi oleh Admin!\n\nSilakan akses dan unduh foto Anda melalui tautan galeri berikut:\n${link}\n\nTerima kasih telah mempercayakan momen berharga Anda pada Zeey Studio!`;
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        
        if (waTab) {
          waTab.location.href = waUrl;
        } else {
          window.open(waUrl, '_blank');
        }
      }
    } catch(err) {
      if (waTab) waTab.close();
      alert("Gagal memverifikasi: " + err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRejectPayment = async (project: Project) => {
    setIsVerifying(true);
    try {
      await updateDoc(doc(db, "projects", project.id), {
        paymentProofStatus: 'rejected'
      });
      setVerifyingProject(null);
      fetchProjects();
    } catch(err) {
      alert("Gagal menolak: " + err);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    const savedProfile = localStorage.getItem("zeey_profile");
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (e) {}
    }
  }, []);

  const updateStatus = async (id: string, newStatus: string, extraData: any = {}) => {
    try {
      await updateDoc(doc(db, "projects", id), {
        status: newStatus,
        ...extraData
      });

      const { logActivity } = await import("@/lib/audit");
      await logActivity("Ubah Status Pesanan", `Mengubah status pesanan ID ${id} menjadi ${newStatus}`);

      // WhatsApp Notification Logic
      const project = projects.find(p => p.id === id);
      
      if (project) {
        let message = "";
        if (newStatus === 'Menunggu Pemilihan') {
          message = `Halo ${project.clientName},\n\nSesi foto Anda sudah selesai!\nSilakan klik tautan berikut untuk memilih foto mana yang ingin kami edit:\n${window.location.origin}/client/${id}\n\nTerima kasih,\nZeey Studio`;
        } else if (newStatus === 'File Terkirim') {
          message = `Halo ${project.clientName},\n\nSemua file foto Anda (termasuk yang sudah diedit) telah siap!\nSilakan cek dan unduh melalui galeri Anda:\n${window.location.origin}/client/${id}\n\nTerima kasih telah mempercayakan momen berharga Anda pada Zeey Studio!`;
        }

        if (message) {
          // Format number (remove non-digits, ensure it starts with country code if needed, assuming it's mostly Indonesian 62 or 08)
          const phone = normalizeWaNumber(project.waNumber);
          const encodedMessage = encodeURIComponent(message);
          const waUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
          window.open(waUrl, '_blank');
        }
      }

      // Auto-Payroll / Commission Logic — dicatat oleh server (data komisi & pengeluaran khusus Owner)
      if (newStatus === 'File Terkirim' && project?.assignedAdmin) {
        try {
          await authFetch('/api/staff/commission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: id }),
          });
        } catch (err) {
          console.error("Gagal mencatat komisi otomatis:", err);
        }
      }

      fetchProjects();
    } catch (e) {
      alert("Gagal mengupdate status");
      console.error(e);
    }
  };

  const handleReopenProject = async (project: Project) => {
    const previouslySelected = project.selectedPhotoIds || [];
    const prevCount = previouslySelected.length;
    const maxCount = project.maxPhotos || 0;
    const remaining = Math.max(0, maxCount - prevCount);

    const confirmMsg =
      `Buka kembali sesi pemilihan foto untuk "${project.clientName}"?\n\n` +
      `📊 Rincian Kuota:\n` +
      `• Total Kuota: ${maxCount} foto\n` +
      `• Sudah Dipilih Sebelumnya: ${prevCount} foto\n` +
      `• Sisa Kuota Belum Dipilih: ${remaining} foto\n\n` +
      `Foto yang sudah dipilih/diunduh sebelumnya (${prevCount} foto) akan tetap tersimpan dan ditandai di galeri klien.`;

    if (!confirm(confirmMsg)) return;

    try {
      setIsLoading(true);
      const updateData: any = {
        status: 'Menunggu Pemilihan',
        isReopened: true,
        reopenedAt: new Date().toISOString(),
        previouslySelectedPhotoIds: previouslySelected,
      };

      if (project.subTokens && project.subTokens.length > 0) {
        updateData.subTokens = project.subTokens.map(st => ({
          ...st,
          status: 'Menunggu Pemilihan' as const,
          previouslySelectedPhotoIds: st.selectedPhotoIds || [],
        }));
      }

      await updateDoc(doc(db, "projects", project.id), updateData);

      const { logActivity } = await import("@/lib/audit");
      await logActivity("Buka Kembali Proyek", `Membuka kembali sesi pemilihan foto klien ${project.clientName} (${project.id}). Sisa kuota: ${remaining} foto.`);

      await fetchProjects();
      alert(`Berhasil membuka kembali galeri klien ${project.clientName}! Status diubah menjadi 'Menunggu Pemilihan'.`);

      if (project.waNumber) {
        const phone = normalizeWaNumber(project.waNumber);
        const waMsg = `Halo ${project.clientName},\n\nSesi pemilihan foto Anda di Zeey Studio telah dibuka kembali.\nAnda masih memiliki sisa kuota ${remaining} foto yang belum dipilih (dari total ${maxCount} foto paket Anda).\n\nSilakan pilih sisa foto Anda melalui tautan galeri berikut:\n${window.location.origin}/client/${project.id}\n\nTerima kasih,\nZeey Studio`;
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`;
        if (confirm("Kirim tautan pemberitahuan WhatsApp ke klien sekarang?")) {
          window.open(waUrl, '_blank');
        }
      }
    } catch (err: any) {
      console.error("Gagal membuka kembali:", err);
      alert("Gagal membuka kembali: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pesanan klien "${name}"? Tindakan ini tidak dapat dibatalkan.`)) {
      try {
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(doc(db, "projects", id));

        // Clear from localStorage to prevent re-merging
        try {
          const savedProjects = JSON.parse(localStorage.getItem("zeey_projects") || "[]");
          const updatedLocal = savedProjects.filter((p: any) => p.id !== id);
          localStorage.setItem("zeey_projects", JSON.stringify(updatedLocal));
        } catch (e) {
          console.warn("Notice updating local storage on delete:", e);
        }
        
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Hapus Pesanan", `Menghapus pesanan klien ${name} (${id})`);
        
        alert("Pesanan berhasil dihapus.");
        fetchProjects();
      } catch (err) {
        console.error("Gagal menghapus", err);
        alert("Gagal menghapus pesanan.");
      }
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Menunggu Pembayaran': return 'bg-amber-500/12 text-amber-600 dark:text-amber-400';
      case 'Lunas': return 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400';
      case 'Selesai Difoto': return 'bg-sky-500/12 text-sky-600 dark:text-sky-400';
      case 'Menunggu Pemilihan': return 'bg-violet-500/12 text-violet-600 dark:text-violet-400';
      case 'File Terkirim': return 'bg-foreground/8 text-foreground/60';
      default: return 'bg-foreground/8 text-foreground/60';
    }
  };

  // Calendar Helpers
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  
  const handleDateClick = (dateString: string) => {
    router.push(`/dashboard/create?date=${dateString}`);
  };

  const handleDownloadInvoice = async (project: Project) => {
    setIsGeneratingPDF(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const invoiceElement = document.getElementById('invoice-template');
      if (!invoiceElement) throw new Error("Template not found");

      // We need to render the component visible temporarily for html2canvas
      invoiceElement.style.display = 'block';
      invoiceElement.style.position = 'fixed';
      invoiceElement.style.top = '0';
      invoiceElement.style.left = '0';
      invoiceElement.style.zIndex = '-9999';

      const canvas = await html2canvas(invoiceElement, { scale: 2 });
      
      invoiceElement.style.display = 'none'; // hide it back

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Invoice_ZeeyStudio_${project.clientName.replace(/\s+/g, '_')}.pdf`);

      const { logActivity } = await import("@/lib/audit");
      await logActivity("Generate Invoice", `Mengunduh invoice untuk ${project.clientName}`);
      
    } catch (err) {
      console.error("Gagal membuat PDF", err);
      alert("Gagal membuat PDF Invoice");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const sendWhatsAppLink = (project: Project) => {
    if (!project.waNumber) {
      alert("Nomor WhatsApp klien tidak tersedia.");
      return;
    }
    const phone = normalizeWaNumber(project.waNumber);
    const link = `${window.location.origin}/client/${project.id}`;
    let message = "";
    
    if (project.status === 'Menunggu Pembayaran' || project.status === 'Lunas') {
       message = `Halo ${project.clientName},\n\nBerikut adalah tautan galeri Anda di Zeey Studio:\n${link}\n\nNantinya Anda dapat melihat dan mengunduh foto Anda melalui tautan ini. Terima kasih!`;
    } else if (project.status === 'Menunggu Pemilihan') {
       message = `Halo ${project.clientName},\n\nSesi foto Anda sudah selesai!\nSilakan klik tautan berikut untuk memilih foto mana yang ingin kami edit:\n${link}\n\nTerima kasih,\nZeey Studio`;
    } else {
       message = `Halo ${project.clientName},\n\nSemua file foto Anda telah siap!\nSilakan cek dan unduh melalui galeri Anda:\n${link}\n\nTerima kasih telah mempercayakan momen berharga Anda pada Zeey Studio!`;
    }
    
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleCreateFolder = async (project: Project) => {
    setCreatingFolderId(project.id);
    const { formatGDriveUrl } = await import("@/lib/drive-utils");

    if (project.gdriveLinkHighRes) {
      window.open(formatGDriveUrl(project.gdriveLinkHighRes), '_blank');
      setCreatingFolderId(null);
      return;
    }

    // Open new tab synchronously to bypass popup blockers
    const newTab = window.open('about:blank', '_blank');

    try {
      const res = await authFetch('/api/drive/create-project-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: project.clientName })
      });
      
      let data: any = null;
      try {
        data = await res.json();
      } catch (e) {
        // Fallback for static HTML 404 response on static hosting
      }
      
      if (data && data.success && data.folderId) {
        const link = `https://drive.google.com/drive/folders/${data.folderId}`;
        await updateStatus(project.id, 'Menunggu Pemilihan', { 
          gdriveLinkHighRes: link,
          gdriveFolderId: data.folderId 
        });
        
        const { logActivity } = await import("@/lib/audit");
        await logActivity("Buat Folder Drive", `Sistem otomatis membuat folder Drive untuk ${project.clientName}`);

        if (newTab) {
          newTab.location.href = link;
        } else {
          window.open(link, '_blank');
        }
      } else {
        const manualLink = prompt(
          `Pembuatan folder otomatis memerlukan backend Google Drive API.\n\nSilakan buat/buka folder di Google Drive Anda, lalu tempelkan (paste) Link Folder Google Drive di sini:`
        );
        if (manualLink) {
          const folderIdMatch = manualLink.match(/folders\/([a-zA-Z0-9-_]+)/) || manualLink.match(/id=([a-zA-Z0-9-_]+)/);
          const folderId = folderIdMatch ? folderIdMatch[1] : manualLink;
          const fullUrl = formatGDriveUrl(manualLink);
          
          await updateStatus(project.id, project.status === 'Menunggu Pembayaran' ? 'Menunggu Pembayaran' : 'Menunggu Pemilihan', { 
            gdriveLinkHighRes: fullUrl,
            gdriveFolderId: folderId
          });

          if (newTab) {
            newTab.location.href = fullUrl;
          } else {
            window.open(fullUrl, '_blank');
          }
        } else {
          const driveHome = 'https://drive.google.com/drive/my-drive';
          if (newTab) {
            newTab.location.href = driveHome;
          } else {
            window.open(driveHome, '_blank');
          }
        }
      }
    } catch (err) {
      console.error(err);
      const driveHome = 'https://drive.google.com/drive/my-drive';
      if (newTab) {
        newTab.location.href = driveHome;
      } else {
        window.open(driveHome, '_blank');
      }
    } finally {
      setCreatingFolderId(null);
    }
  };

  const handleEventClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const renderCalendar = () => {
    const days = [];
    // Empty slots before 1st day
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="rounded-xl bg-surface-alt/25 min-h-[58px] md:min-h-[96px]"></div>);
    }
    
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      const dayProjects = projects.filter(p => p.shootDate === dateString);
      const isToday = dateString === new Date().toISOString().split('T')[0];

      days.push(
        <div 
          key={d} 
          onClick={() => handleDateClick(dateString)}
          className={`p-1 md:p-1.5 rounded-xl border min-h-[58px] md:min-h-[108px] min-w-0 flex flex-col transition-all cursor-pointer group ${
            isToday ? 'border-accent/40 bg-accent/5' : 'border-border/50 bg-surface-alt/25 hover:bg-surface-alt/60 hover:border-border'
          }`}
        >
          <div className="flex justify-between items-start mb-1 md:mb-2">
            <span className={`text-[11px] md:text-xs font-semibold w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full transition-colors ${isToday ? 'bg-brand text-white shadow-md shadow-violet-500/30' : 'text-foreground/60 group-hover:bg-foreground/10'}`}>{d}</span>
          </div>
          <div className="flex-1 space-y-1 md:space-y-1.5 overflow-y-auto hide-scrollbar max-h-[90px]">
            {dayProjects.map(p => (
              <div 
                key={p.id} 
                onClick={(e) => handleEventClick(e, p)}
                className={`text-[9px] md:text-[11px] leading-tight px-1.5 py-0.5 md:py-1 rounded-lg truncate font-medium ${getStatusBadge(p.status)} hover:brightness-105 transition-all cursor-pointer`} 
                title={`${p.shootTime || ''} - ${p.clientName}`}
              >
                <span className="font-bold hidden md:inline">{p.shootTime} </span>{p.clientName}
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    // Pad remaining grid spaces
    const totalCells = days.length;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < remaining; i++) {
       days.push(<div key={`end-empty-${i}`} className="rounded-xl bg-surface-alt/25 min-h-[58px] md:min-h-[96px]"></div>);
    }
    
    return days;
  };

  // Data untuk kartu ringkasan & kisi kartu
  const aktifList = projects.filter(p => p.status !== 'File Terkirim');
  const selesaiList = projects.filter(p => p.status === 'File Terkirim');
  const pendingCount = projects.filter(p => p.paymentProofStatus === 'pending').length;
  const sesiBulanIni = projects.filter(p => {
    if (!p.shootDate) return false;
    const d = new Date(p.shootDate);
    return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth();
  }).length;

  return (
    <Sidebar>
      <div className="p-3.5 md:p-6 lg:p-8 max-w-7xl mx-auto w-full pb-8">
        <PageHeader
          module="bookings"
          title="Manajemen Pesanan"
          subtitle={userRole === 'owner' ? 'Pantau seluruh jadwal studio dan status pesanan.' : 'Jadwal pemotretan yang ditugaskan kepada Anda.'}
        >
          <div className="flex gap-2 bg-surface-alt/70 p-1 rounded-2xl border border-border/60 w-full md:w-auto inline-flex overflow-x-auto hide-scrollbar">
              <button 
                onClick={() => setActiveTab('aktif')}
                className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'aktif' ? 'bg-surface shadow-md border border-transparent text-foreground' : 'text-foreground/60 hover:text-foreground hover:bg-background/50 border border-transparent'}`}
              >
                Pesanan Aktif
              </button>
              <button 
                onClick={() => setActiveTab('selesai')}
                className={`flex-1 md:flex-none px-5 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'selesai' ? 'bg-surface shadow-md border border-transparent text-foreground' : 'text-foreground/60 hover:text-foreground hover:bg-background/50 border border-transparent'}`}
              >
                Riwayat Selesai
              </button>
            </div>
        </PageHeader>

        {/* Data gagal dimuat: jangan tampilkan daftar kosong seolah tidak ada pesanan */}
        {loadFailed && !isLoading && (
          <div className="mb-4 flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-400 animate-in fade-in">
            <svg className="w-4 h-4 shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="flex-1">
              <strong className="block font-semibold">Gagal memuat data terbaru</strong>
              Koneksi ke server terputus, jadi daftar di bawah mungkin belum lengkap.
            </div>
            <button
              type="button"
              onClick={fetchProjects}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 font-semibold transition-colors cursor-pointer"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Modal Verifikasi Pembayaran */}
        {verifyingProject && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-5 md:p-6 border-b border-border bg-surface-alt/30">
                <h3 className="text-base md:text-lg font-bold tracking-tight text-foreground">Verifikasi Bukti Pembayaran</h3>
                <button onClick={() => setVerifyingProject(null)} className="text-foreground/50 hover:text-foreground p-2 rounded-full hover:bg-border transition-colors cursor-pointer">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              
              <div className="p-5 md:p-6 overflow-y-auto flex-1 font-sans">
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800 flex gap-3 items-start">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <p>Klien <strong>{verifyingProject.clientName}</strong> telah menekan tombol konfirmasi pembayaran. Klien diarahkan untuk mengirim <strong>screenshot bukti transfer</strong> ke WhatsApp Admin.</p>
                  {verifyingProject.pendingPayment?.amount && String(verifyingProject.pendingPayment.mode || '').startsWith('qris') && (
                    <div className="mt-3 p-3 rounded-xl bg-accent/10 border border-accent/30 text-sm">
                      Cocokkan di aplikasi <strong>DANA Bisnis</strong>: dana masuk sebesar{" "}
                      <strong className="font-mono text-accent">Rp {verifyingProject.pendingPayment.amount.toLocaleString('id-ID')}</strong>
                      {verifyingProject.pendingPayment.uniqueCode ? <> (termasuk kode unik Rp {verifyingProject.pendingPayment.uniqueCode.toLocaleString('id-ID')})</> : null}.
                    </div>
                  )}
                </div>
                
                <div className="bg-green-50/50 rounded-xl border border-green-200 p-6 flex flex-col items-center justify-center min-h-[150px] text-center">
                  <svg className="w-12 h-12 text-green-500 mb-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  <h4 className="text-base font-bold tracking-tight text-green-800 mb-2">Periksa WhatsApp Anda</h4>
                  <p className="text-green-700/80 text-sm mb-2">Apakah Anda sudah menerima bukti transfer yang valid dari klien ini?</p>
                  <span className="text-xs bg-green-200/60 text-green-900 px-3 py-1.5 rounded-lg font-medium">
                    ✨ Klik 'Terima Pembayaran' akan otomatis membuka WhatsApp untuk mengirim link download foto.
                  </span>
                </div>
              </div>

              <div className="p-5 md:p-6 border-t border-border bg-surface-alt/30 flex justify-end gap-3 font-sans">
                <button 
                  onClick={() => handleRejectPayment(verifyingProject)}
                  disabled={isVerifying}
                  className="px-6 py-2.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Tolak Bukti
                </button>
                <button 
                  onClick={() => handleApprovePayment(verifyingProject)}
                  disabled={isVerifying}
                  className="px-6 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent-dark transition-colors cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  {isVerifying ? 'Memproses...' : 'Terima Pembayaran & Kirim WA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-24" />)}
            </div>
            <SkeletonBlock className="h-72" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-60" />)}
            </div>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-5">
            {/* ── Ringkasan cepat ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
              <StatCard label="Pesanan Aktif" value={aktifList.length} hint="Sedang berjalan" tone="amber" icon={ICON.clock} />
              <StatCard label="Perlu Verifikasi" value={pendingCount} hint="Konfirmasi transfer" tone="pink" icon={ICON.cash} />
              <StatCard label="Sesi Bulan Ini" value={sesiBulanIni} hint={`${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`} tone="violet" icon={ICON.calendar} />
              <StatCard label="Selesai" value={selesaiList.length} hint="File sudah terkirim" tone="emerald" icon={ICON.check} />
            </div>

            {/* ── Peringatan pembayaran menunggu verifikasi ────────────── */}
            {activeTab === 'aktif' && pendingCount > 0 && (
              <div className="flex items-start gap-3 rounded-3xl bg-amber-500/10 border border-amber-500/30 p-4 animate-in fade-in slide-in-from-bottom-2">
                <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                  <Icon d={ICON.bolt} className="w-[18px] h-[18px]" strokeWidth={2.2} />
                </span>
                <div className="text-xs">
                  <h4 className="font-bold text-sm text-foreground">{pendingCount} pesanan menunggu verifikasi pembayaran</h4>
                  <p className="text-foreground/60 leading-snug mt-0.5">
                    Klien sudah mengirim konfirmasi transfer. Tekan <strong>Setujui</strong> pada kartunya untuk langsung membuka akses galeri.
                  </p>
                </div>
              </div>
            )}

            {/* ── Kalender ────────────────────────────────────────────── */}
            {activeTab === 'aktif' && (
              <section className="rounded-3xl bg-surface border border-border/70 shadow-sm p-4 md:p-5 animate-in fade-in slide-in-from-bottom-2">
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 shrink-0">
                      <Icon d={ICON.calendar} className="w-[18px] h-[18px]" strokeWidth={2.2} />
                    </span>
                    <div>
                      <h2 className="text-sm md:text-base font-bold tracking-tight leading-tight">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                      </h2>
                      <p className="text-[11px] text-foreground/50 leading-tight">Ketuk tanggal untuk membuat booking</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={prevMonth} aria-label="Bulan sebelumnya" className="w-9 h-9 rounded-xl bg-surface-alt/70 hover:bg-surface-alt border border-border/60 flex items-center justify-center transition-colors cursor-pointer press">
                      <Icon d={ICON.left} className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-3.5 h-9 rounded-xl bg-surface-alt/70 hover:bg-surface-alt border border-border/60 text-xs font-semibold transition-colors cursor-pointer press">
                      Hari Ini
                    </button>
                    <button onClick={nextMonth} aria-label="Bulan berikutnya" className="w-9 h-9 rounded-xl bg-surface-alt/70 hover:bg-surface-alt border border-border/60 flex items-center justify-center transition-colors cursor-pointer press">
                      <Icon d={ICON.right} className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                </header>

                <div className="md:overflow-x-auto pb-1 hide-scrollbar">
                  <div className="md:min-w-[640px]">
                    <div className="grid grid-cols-7 gap-1 md:gap-1.5">
                      {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
                        <div key={day} className="py-1.5 text-center text-[10px] font-bold text-foreground/40 uppercase tracking-wider">{day}</div>
                      ))}
                      {renderCalendar()}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── Kisi kartu pesanan ──────────────────────────────────── */}
            {(() => {
              const daftar = activeTab === 'aktif' ? aktifList : selesaiList;
              if (daftar.length === 0) {
                return (
                  <div className="rounded-3xl border border-dashed border-border bg-surface-alt/30 py-14 text-center animate-in fade-in">
                    <span className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-surface border border-border/60 flex items-center justify-center text-foreground/30">
                      <Icon d={ICON.clipboard} className="w-6 h-6" />
                    </span>
                    <p className="text-sm font-semibold text-foreground/70">
                      {activeTab === 'aktif' ? 'Belum ada pesanan aktif' : 'Belum ada pesanan selesai'}
                    </p>
                    {activeTab === 'aktif' && (
                      <Link href="/dashboard/create" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
                        Buat booking baru
                        <Icon d={ICON.right} className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </Link>
                    )}
                  </div>
                );
              }

              return (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 stagger">
                  {daftar.map((project) => {
                    const selesai = project.status === 'File Terkirim';
                    const perluVerifikasi = project.paymentProofStatus === 'pending';
                    const warna = AVATAR_GRADIENTS[(project.clientName || '?').charCodeAt(0) % AVATAR_GRADIENTS.length];
                    return (
                      <article
                        key={project.id}
                        className={`relative overflow-hidden rounded-3xl bg-surface border shadow-sm p-4 flex flex-col gap-3 lift ${
                          perluVerifikasi ? 'border-amber-500/40' : 'border-border/70'
                        }`}
                      >
                        <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${perluVerifikasi ? 'from-amber-400 to-orange-500' : selesai ? 'from-slate-400 to-slate-500' : warna} opacity-80`} />

                        {/* Identitas */}
                        <header className="flex items-start gap-3 pt-1">
                          <span className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${warna} text-white font-bold flex items-center justify-center shrink-0 shadow-md`}>
                            {(project.clientName || '?').charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-sm leading-tight truncate" title={project.clientName}>{project.clientName}</h3>
                            <p className="text-[11px] text-foreground/50 leading-tight mt-0.5">
                              {project.shootDate ? new Date(project.shootDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanggal belum diatur'}
                              {project.shootTime ? ` · ${project.shootTime}` : ''}
                            </p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${getStatusBadge(project.status)}`}>
                            {project.status}
                          </span>
                        </header>

                        {/* Detail ringkas */}
                        <dl className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="rounded-2xl bg-surface-alt/60 px-3 py-2 min-w-0">
                            <dt className="text-foreground/45 font-medium">Paket</dt>
                            <dd className="font-semibold truncate" title={project.packageName}>{project.packageName || '-'}</dd>
                          </div>
                          <div className="rounded-2xl bg-surface-alt/60 px-3 py-2 min-w-0">
                            <dt className="text-foreground/45 font-medium">Fotografer</dt>
                            <dd className="font-semibold truncate" title={project.assignedAdmin}>{project.assignedAdmin || '-'}</dd>
                          </div>
                        </dl>

                        {/* Menunggu verifikasi pembayaran */}
                        {perluVerifikasi && (
                          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-2.5">
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                              Menunggu verifikasi pembayaran
                            </p>
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => handleApprovePayment(project)}
                                disabled={isVerifying}
                                title="Setujui pembayaran dan buka akses galeri foto untuk klien"
                                className="flex-1 py-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-[11px] font-bold shadow-md shadow-emerald-500/25 transition-all hover:brightness-110 disabled:opacity-60 cursor-pointer press"
                              >
                                ✓ Setujui (1-Klik)
                              </button>
                              <button
                                onClick={() => setVerifyingProject(project)}
                                className="px-3 py-2 rounded-xl bg-surface border border-border/60 text-[11px] font-semibold hover:bg-surface-alt transition-colors cursor-pointer press"
                              >
                                Detail
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Aksi utama */}
                        <div className="mt-auto space-y-2">
                          {!selesai ? (
                            <>
                              <button
                                onClick={() => setUploadModalProject(project)}
                                className="w-full py-2.5 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white text-xs font-bold shadow-md shadow-sky-500/25 transition-all hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer press"
                              >
                                <Icon d={ICON.upload} className="w-4 h-4" />
                                Upload Foto (GDrive)
                              </button>

                              <div className="grid grid-cols-2 gap-2">
                                {project.status === 'Menunggu Pembayaran' && userRole === 'owner' && (
                                  <button onClick={() => updateStatus(project.id, 'Lunas')} className="py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[11px] font-bold hover:bg-emerald-500/20 transition-colors cursor-pointer press">
                                    Tandai Lunas
                                  </button>
                                )}
                                {(project.status === 'Menunggu Pemilihan' || project.status === 'Selesai Difoto') && (
                                  <button onClick={() => updateStatus(project.id, 'File Terkirim')} className="py-2 rounded-xl bg-surface-alt/70 border border-border/60 text-[11px] font-bold hover:bg-surface-alt transition-colors cursor-pointer press">
                                    Tandai Selesai
                                  </button>
                                )}
                                <button
                                  onClick={() => { setMultiTokenProject(project); setIsMultiTokenOpen(true); }}
                                  className="py-2 rounded-xl bg-accent/10 text-accent border border-accent/25 text-[11px] font-bold hover:bg-accent/20 transition-colors cursor-pointer press truncate"
                                >
                                  {project.subTokens && project.subTokens.length > 0 ? `Sub-Token (${project.subTokens.length})` : 'Bagi Token Link'}
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => sendWhatsAppLink(project)}
                                title="Kirim Link Galeri & Download Foto ke WhatsApp Klien"
                                className="w-full py-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-bold shadow-md shadow-emerald-500/25 transition-all hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer press"
                              >
                                <WaIcon />
                                Kirim Link WA
                              </button>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleDownloadInvoice(project)}
                                  disabled={isGeneratingPDF}
                                  className="py-2 rounded-xl bg-surface-alt/70 border border-border/60 text-[11px] font-bold hover:bg-surface-alt transition-colors disabled:opacity-60 cursor-pointer press"
                                >
                                  {isGeneratingPDF ? 'Membuat…' : 'Invoice PDF'}
                                </button>
                                <button
                                  onClick={() => handleReopenProject(project)}
                                  title="Buka kembali sesi pemilihan foto untuk memilih sisa kuota"
                                  className="py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 text-[11px] font-bold hover:bg-amber-500/20 transition-colors cursor-pointer press"
                                >
                                  Buka Kembali
                                </button>
                              </div>
                            </>
                          )}

                          {/* Baris ikon */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <Link
                              href={`/client/${project.id}`}
                              target="_blank"
                              title="Buka galeri klien"
                              className="flex-1 h-9 rounded-xl bg-surface-alt/70 border border-border/60 text-[11px] font-semibold hover:bg-surface-alt transition-colors flex items-center justify-center gap-1.5 press"
                            >
                              <Icon d={ICON.image} className="w-3.5 h-3.5" />
                              Galeri
                            </Link>
                            {!selesai && (
                              <button onClick={() => sendWhatsAppLink(project)} title="Kirim ke WhatsApp klien" className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 transition-colors flex items-center justify-center cursor-pointer press">
                                <WaIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/client/${project.id}`); alert("Tautan disalin!"); }}
                              title="Salin tautan klien"
                              className="w-9 h-9 rounded-xl bg-surface-alt/70 border border-border/60 hover:bg-surface-alt transition-colors flex items-center justify-center cursor-pointer press"
                            >
                              <Icon d={ICON.copy} className="w-3.5 h-3.5" />
                            </button>
                            {!selesai && (
                              <>
                                <Link href={`/dashboard/create?edit=${project.id}`} title="Edit pesanan" className="w-9 h-9 rounded-xl bg-surface-alt/70 border border-border/60 hover:bg-surface-alt hover:text-blue-500 transition-colors flex items-center justify-center press">
                                  <Icon d={ICON.edit} className="w-3.5 h-3.5" />
                                </Link>
                                <button onClick={() => handleDelete(project.id, project.clientName)} title="Hapus pesanan" className="w-9 h-9 rounded-xl bg-surface-alt/70 border border-border/60 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors flex items-center justify-center cursor-pointer press">
                                  <Icon d={ICON.trash} className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

      {/* Event Detail Modal */}
      {isModalOpen && selectedProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}>
          <div className="bg-surface w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-4 md:p-6 border-b border-border/50 bg-surface-alt/30">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg md:text-xl font-bold tracking-tight mb-2">{selectedProject.clientName}</h2>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium whitespace-nowrap ${getStatusBadge(selectedProject.status)}`}>
                    {selectedProject.status}
                  </span>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-foreground/50 hover:text-foreground hover:bg-surface-alt rounded-full transition-colors cursor-pointer">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
            
            <div className="p-4 md:p-6 space-y-4 font-sans text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background border border-border p-3 rounded-xl">
                  <p className="text-foreground/50 mb-1 text-xs uppercase tracking-wider font-semibold">Tanggal</p>
                  <p className="font-medium text-foreground">{selectedProject.shootDate ? new Date(selectedProject.shootDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}</p>
                </div>
                <div className="bg-background border border-border p-3 rounded-xl">
                  <p className="text-foreground/50 mb-1 text-xs uppercase tracking-wider font-semibold">Waktu</p>
                  <p className="font-medium text-foreground">{selectedProject.shootTime || '-'}</p>
                </div>
                <div className="bg-background border border-border p-3 rounded-xl">
                  <p className="text-foreground/50 mb-1 text-xs uppercase tracking-wider font-semibold">Paket</p>
                  <p className="font-medium text-foreground">{selectedProject.packageName || '-'}</p>
                </div>
                <div className="bg-background border border-border p-3 rounded-xl">
                  <p className="text-foreground/50 mb-1 text-xs uppercase tracking-wider font-semibold">Fotografer</p>
                  <p className="font-medium text-foreground">{selectedProject.assignedAdmin || '-'}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 md:p-6 border-t border-border/50 flex flex-col gap-3">
              {selectedProject.status === 'Menunggu Pembayaran' && userRole === 'owner' && (
                <button onClick={() => { updateStatus(selectedProject.id, 'Lunas'); setIsModalOpen(false); }} className="w-full bg-green-500 text-white px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-green-600 transition-colors shadow-sm cursor-pointer">
                  Tandai Lunas
                </button>
              )}
              
              {selectedProject.status === 'Lunas' && (
                <button 
                  onClick={() => {
                    if (selectedProject.gdriveLinkHighRes) {
                      // Buka folder di tab baru
                      window.open(selectedProject.gdriveLinkHighRes, '_blank');
                      
                      // Konfirmasi penyelesaian
                      setTimeout(() => {
                        if (confirm("Apakah Anda sudah selesai mengunggah (upload) semua foto ke dalam folder Google Drive tersebut?")) {
                          updateStatus(selectedProject.id, 'Menunggu Pemilihan');
                          setIsModalOpen(false);
                        }
                      }, 500);
                    } else {
                      // Fallback jika tidak ada link otomatis
                      const link = prompt("Masukkan Link Google Drive untuk Klien (Folder Pemilihan):");
                      if (link) {
                        const folderIdMatch = link.match(/folders\/([a-zA-Z0-9-_]+)/) || link.match(/id=([a-zA-Z0-9-_]+)/);
                        const folderId = folderIdMatch ? folderIdMatch[1] : link; // fallback
                        
                        updateStatus(selectedProject.id, 'Menunggu Pemilihan', { 
                          gdriveLinkHighRes: link,
                          gdriveFolderId: folderId
                        });
                        setIsModalOpen(false);
                      }
                    }
                  }} 
                  className="w-full bg-blue-500 text-white px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
                >
                  {selectedProject.gdriveLinkHighRes ? "Buka Folder & Selesai Foto" : "Paste Link GDrive & Selesai Foto"}
                </button>
              )}
              
              {(selectedProject.status === 'Menunggu Pemilihan' || selectedProject.status === 'Selesai Difoto') && (
                <button onClick={() => { updateStatus(selectedProject.id, 'File Terkirim'); setIsModalOpen(false); }} className="w-full bg-foreground text-surface px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-black transition-colors shadow-sm cursor-pointer">
                  Tandai File Terkirim (Tutup)
                </button>
              )}

              {(selectedProject.status === 'File Terkirim' || selectedProject.status === 'Selesai') && (
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    handleReopenProject(selectedProject);
                  }} 
                  className="w-full bg-amber-500 text-white px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Buka Kembali (Reopen) Sisa Kuota
                </button>
              )}
              
              <Link href={`/client/${selectedProject.id}`} target="_blank" className="w-full flex items-center justify-center gap-2 bg-surface-alt border border-border px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-border transition-colors">
                Buka Galeri Klien
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
              </Link>
              
              <button 
                onClick={() => handleDownloadInvoice(selectedProject)}
                disabled={isGeneratingPDF}
                className="w-full flex items-center justify-center gap-2 bg-white border border-border text-foreground px-4 py-3.5 rounded-xl text-sm font-medium hover:bg-surface-alt transition-colors disabled:opacity-50"
              >
                {isGeneratingPDF ? "Membuat PDF..." : "Unduh Invoice (PDF)"}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Invoice Template for PDF Generation */}
      {selectedProject && (
        <div id="invoice-template" style={{ display: 'none', width: '1122px', backgroundColor: 'white', padding: '40px', color: 'black', fontFamily: 'sans-serif' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #f3f4f6', paddingBottom: '20px', marginBottom: '30px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 5px 0', color: '#111827' }}>INVOICE</h1>
              <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>#INV-{selectedProject.id.slice(-6).toUpperCase()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                <svg style={{ width: '24px', height: '24px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                  <circle cx="12" cy="13" r="3"></circle>
                </svg>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{profile?.studioName || "Zeey Studio"}</h2>
              </div>
              <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#4b5563', whiteSpace: 'pre-wrap' }}>{profile?.address || "Alamat Studio Belum Diatur"}</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#4b5563' }}>{profile?.email || (profile?.waNumber ? `WA: ${profile.waNumber}` : "-")}</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 8px 0' }}>Ditagihkan Kepada:</p>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#111827' }}>{selectedProject.clientName}</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#4b5563' }}>{selectedProject.waNumber || '-'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 4px 0' }}>Tanggal Invoice</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                  {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#9ca3af', margin: '0 0 4px 0' }}>Status Pembayaran</p>
                <span style={{ 
                  display: 'inline-block', 
                  padding: '4px 12px', 
                  borderRadius: '9999px', 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  backgroundColor: selectedProject.status === 'Menunggu Pembayaran' ? '#fef9c3' : '#dcfce3',
                  color: selectedProject.status === 'Menunggu Pembayaran' ? '#854d0e' : '#166534',
                }}>
                  {selectedProject.status === 'Menunggu Pembayaran' ? 'BELUM LUNAS' : 'LUNAS'}
                </span>
              </div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', color: '#4b5563', fontWeight: '600' }}>Deskripsi Layanan</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', color: '#4b5563', fontWeight: '600' }}>Tanggal Foto</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '14px', color: '#4b5563', fontWeight: '600' }}>Total Harga</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '16px 12px', fontSize: '15px', color: '#111827', fontWeight: '500' }}>{selectedProject.packageName}</td>
                <td style={{ padding: '16px 12px', textAlign: 'center', fontSize: '14px', color: '#4b5563' }}>
                  {selectedProject.shootDate ? new Date(selectedProject.shootDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}
                </td>
                <td style={{ padding: '16px 12px', textAlign: 'right', fontSize: '15px', color: '#111827', fontWeight: '500' }}>
                  Rp {(selectedProject.packagePrice || 0).toLocaleString("id-ID")}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '60px' }}>
            <div style={{ width: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '14px', color: '#4b5563' }}>Subtotal</span>
                <span style={{ fontSize: '14px', color: '#111827', fontWeight: '500' }}>Rp {(selectedProject.packagePrice || 0).toLocaleString("id-ID")}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', borderRadius: '0 0 8px 8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>Total Bayar</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>Rp {(selectedProject.packagePrice || 0).toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', marginTop: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
            <p style={{ margin: '0 0 4px 0' }}>Terima kasih telah menggunakan jasa {profile?.studioName || "Zeey Studio"}.</p>
            <p style={{ margin: 0 }}>Invoice ini sah dan digenerate secara otomatis oleh sistem.</p>
            {(profile?.instagram || profile?.tiktok) && (
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                {profile?.instagram && <span style={{ marginRight: '10px' }}>IG: {profile.instagram}</span>}
                {profile?.tiktok && <span>TikTok: {profile.tiktok}</span>}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Multi-Token Link Modal */}
      <MultiTokenModal
        isOpen={isMultiTokenOpen}
        onClose={() => setIsMultiTokenOpen(false)}
        project={multiTokenProject}
        onProjectUpdated={fetchProjects}
      />
      <GDriveUploadModal
        isOpen={!!uploadModalProject}
        onClose={() => setUploadModalProject(null)}
        project={uploadModalProject}
        onProjectUpdated={fetchProjects}
      />
    </div>
    </Sidebar>
  );
}
