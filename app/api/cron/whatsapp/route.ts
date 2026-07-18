import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';

export async function GET(request: Request) {
  try {
    // 1. Validasi Keamanan (Security Check)
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    // Ganti 'RAHASIAZEEY123' dengan token rahasia Anda di Vercel Env atau samakan dengan yang di vercel.json
    if (token !== 'RAHASIAZEEY123') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Ambil Fonnte Token dari Pengaturan
    const settingsDoc = await getDoc(doc(db, "settings", "integration"));
    if (!settingsDoc.exists()) {
      return NextResponse.json({ success: false, error: 'Pengaturan integrasi tidak ditemukan' }, { status: 404 });
    }
    
    const integrationData = settingsDoc.data();
    const fonnteToken = integrationData.fonnteToken;
    const localBotUrl = integrationData.localBotUrl;
    
    if (!fonnteToken && !localBotUrl) {
      return NextResponse.json({ success: false, error: 'Token Fonnte atau Bot Lokal belum dikonfigurasi di dashboard' }, { status: 400 });
    }

    // 3. Ambil Semua Data Pesanan Aktif
    const projectsSnap = await getDocs(collection(db, "projects"));
    const now = new Date();
    
    // Hitung besok dalam zona waktu Asia/Jakarta (WIB)
    // Untuk menyederhanakan, kita tambah 1 hari dari sekarang
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }); // Format YYYY-MM-DD

    const results = {
      unpaidReminders: 0,
      h1Reminders: 0,
      errors: [] as string[]
    };

    // Fungsi helper untuk kirim WA via Fonnte
    const sendWA = async (target: string, message: string) => {
      let cleanTarget = target.replace(/[^0-9]/g, "");
      if (cleanTarget.startsWith("0")) {
        cleanTarget = "62" + cleanTarget.substring(1);
      }
      
      if (localBotUrl) {
        try {
          const botResponse = await fetch(`${localBotUrl}/api/send-message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: cleanTarget, message })
          });
          if (botResponse.ok) {
            const data = await botResponse.json();
            if (data.status) return data;
          }
        } catch (err) {
          console.warn("Local bot failed in cron, falling back to Fonnte...");
        }
      }

      if (!fonnteToken) throw new Error("Fonnte API token is missing, and local bot failed");

      const response = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          "Authorization": fonnteToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          target: cleanTarget,
          message: message
        })
      });
      
      const data = await response.json();
      if (!data.status) {
        throw new Error(data.reason || "Fonnte API error");
      }
      return data;
    };

    // 4. Proses Setiap Pesanan
    for (const docSnap of projectsSnap.docs) {
      const project = docSnap.data();
      const projectId = docSnap.id;
      
      // Jika pesanan sudah selesai, abaikan
      if (['Lunas', 'Selesai Difoto', 'Menunggu Pemilihan', 'File Terkirim'].includes(project.status)) {
        continue;
      }

      // --- TUGAS A: Penagih Hutang Otomatis (> 24 Jam) ---
      if (project.status === 'Menunggu Pembayaran' && !project.isUnpaidReminded) {
        const createdAt = new Date(project.createdAt);
        const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (diffHours >= 24) {
          try {
            const msg = `Halo ${project.clientName},\n\nKami dari Zeey Studio ingin menginformasikan bahwa pesanan foto Anda (Paket: ${project.packageName || '-'}) saat ini masih menunggu pembayaran.\n\nTotal: Rp ${project.packagePrice?.toLocaleString('id-ID') || 0}\n\nSilakan lakukan pembayaran dan konfirmasi melalui link berikut:\nhttps://zeeystudio.vercel.app/client/${projectId}\n\nTerima kasih!`;
            
            await sendWA(project.waNumber, msg);
            await updateDoc(doc(db, "projects", projectId), { isUnpaidReminded: true });
            results.unpaidReminders++;
          } catch (err: any) {
            results.errors.push(`Gagal menagih ${project.clientName}: ${err.message}`);
          }
        }
      }

      // --- TUGAS B: Reminder H-1 Pemotretan ---
      // Pastikan status bukan Menunggu Pembayaran (idealnya Lunas/DP, tapi mari kita asumsikan jika ada jadwal maka bisa diingatkan asalkan belum dibatalkan)
      if (project.shootDate === tomorrowStr && !project.isH1Reminded) {
        try {
          const msg = `Halo ${project.clientName}!\n\nZeey Studio mengingatkan bahwa jadwal pemotretan Anda jatuh pada BESOK hari.\n\nTanggal: ${project.shootDate}\nJam: ${project.shootTime}\n\nHarap hadir tepat waktu ya. Kami tunggu kedatangannya!\n\nSalam,\nZeey Studio`;
          
          await sendWA(project.waNumber, msg);
          await updateDoc(doc(db, "projects", projectId), { isH1Reminded: true });
          results.h1Reminders++;
        } catch (err: any) {
          results.errors.push(`Gagal mengingatkan H-1 ${project.clientName}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cron job berhasil dijalankan',
      results
    });
    
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan' },
      { status: 500 }
    );
  }
}
