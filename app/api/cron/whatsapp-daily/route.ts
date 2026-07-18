import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export async function GET(req: Request) {
  try {
    // 1. Get Integration Token
    const integrationDoc = await getDoc(doc(db, "settings", "integration"));
    const integration = integrationDoc.exists() ? integrationDoc.data() : null;

    if (!integration) {
      return NextResponse.json({ success: false, message: "Integration settings not configured" });
    }

    const fonnteToken = integration.fonnteToken;
    const localBotUrl = integration.localBotUrl;
    
    if (!fonnteToken && !localBotUrl) {
      return NextResponse.json({ success: false, message: "Neither Fonnte token nor Local Bot configured" });
    }

    // 2. Fetch Projects
    const snapshot = await getDocs(collection(db, "projects"));
    const projects: any[] = [];
    snapshot.forEach((document) => {
      projects.push({ id: document.id, ...document.data() });
    });

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    let messagesSent = 0;

    for (const project of projects) {
      if (!project.waNumber) continue;

      let message = "";

      // Logic 1: Reminder H-1
      if (project.shootDate === tomorrowString && project.status !== 'File Terkirim') {
        message = `Halo ${project.clientName},\n\nIni adalah pengingat otomatis dari Zeey Studio.\nJadwal pemotretan Anda adalah besok: *${project.shootDate}*${project.shootTime ? ` jam *${project.shootTime}*` : ''}.\n\nMohon hadir tepat waktu ya. Sampai jumpa!\n\nSalam,\nZeey Studio`;
      } 
      // Logic 2: Tagihan Otomatis
      else if (project.status === 'Menunggu Pembayaran') {
        const createdAt = new Date(project.createdAt);
        const diffDays = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 3600 * 24));
        
        // Reminder on Day 1 and Day 3 of unpaid invoice
        if (diffDays === 1 || diffDays === 3) {
          message = `Halo ${project.clientName},\n\nKami mengingatkan bahwa status pesanan pemotretan Anda masih *Menunggu Pembayaran*.\nSilakan selesaikan pembayaran untuk mengamankan jadwal Anda.\n\nJika Anda sudah membayar, abaikan pesan ini atau hubungi admin kami.\n\nTerima kasih,\nZeey Studio`;
        }
      }

      if (message) {
        // Clean number
        let cleanNumber = project.waNumber.replace(/[^0-9]/g, "");
        if (cleanNumber.startsWith("0")) cleanNumber = "62" + cleanNumber.substring(1);

        try {
          let sent = false;
          if (localBotUrl) {
            try {
              const botResponse = await fetch(`${localBotUrl}/api/send-message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target: cleanNumber, message })
              });
              if (botResponse.ok) {
                const data = await botResponse.json();
                if (data.status) sent = true;
              }
            } catch (err) {
              console.warn("Local bot failed in daily cron, falling back to Fonnte...");
            }
          }

          if (!sent && fonnteToken) {
            await fetch("https://api.fonnte.com/send", {
              method: "POST",
              headers: {
                "Authorization": fonnteToken,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                target: cleanNumber,
                message: message
              })
            });
            sent = true;
          }

          if (sent) messagesSent++;
        } catch (e) {
          console.error("Error sending cron WA:", e);
        }
      }
    }

    return NextResponse.json({ success: true, messagesSent });
  } catch (error: any) {
    console.error('Cron Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
