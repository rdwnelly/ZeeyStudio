import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { waNumber, clientName } = await request.json();

    if (!waNumber || !clientName) {
      return NextResponse.json(
        { success: false, error: 'waNumber and clientName are required' },
        { status: 400 }
      );
    }

    // Get Integration Settings
    const { db } = await import("@/lib/firebase");
    const { doc, getDoc } = await import("firebase/firestore");
    const integrationDoc = await getDoc(doc(db, "settings", "integration"));
    const integration = integrationDoc.exists() ? integrationDoc.data() : null;

    if (!integration) {
      return NextResponse.json({ success: false, error: 'Pengaturan integrasi tidak ditemukan' }, { status: 404 });
    }

    const fonnteToken = integration.fonnteToken;
    const localBotUrl = integration.localBotUrl;

    if (!fonnteToken && !localBotUrl) {
      return NextResponse.json({ success: false, error: 'Token Fonnte atau Bot Lokal belum dikonfigurasi' }, { status: 400 });
    }

    let cleanNumber = waNumber.replace(/[^0-9]/g, "");
    if (cleanNumber.startsWith("0")) {
      cleanNumber = "62" + cleanNumber.substring(1);
    }

    const message = `Halo ${clientName},\n\nZeey Studio mengingatkan bahwa Anda memiliki jadwal pemotretan bersama kami.\n\nHarap hadir tepat waktu ya. Kami tunggu kedatangannya!\n\nSalam,\nZeey Studio`;

    let sent = false;
    let via = "";

    if (localBotUrl) {
      try {
        const botResponse = await fetch(`${localBotUrl}/api/send-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: cleanNumber, message })
        });
        if (botResponse.ok) {
          const data = await botResponse.json();
          if (data.status) {
            sent = true;
            via = "Local Bot";
          }
        }
      } catch (err) {
        console.warn("Local bot failed, falling back to Fonnte...");
      }
    }

    if (!sent && fonnteToken) {
      const response = await fetch("https://api.fonnte.com/send", {
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
      const data = await response.json();
      if (data.status) {
        sent = true;
        via = "Fonnte";
      } else {
        throw new Error(data.reason || "Fonnte API error");
      }
    }

    if (!sent) {
      throw new Error("Gagal mengirim pesan melalui semua channel (Bot Lokal dan Fonnte)");
    }

    return NextResponse.json({
      success: true,
      message: `Pesan pengingat berhasil dikirim ke ${clientName} (${cleanNumber}) via ${via}`
    });
  } catch (error: any) {
    console.error("Error sending WhatsApp reminder:", error);
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
}
