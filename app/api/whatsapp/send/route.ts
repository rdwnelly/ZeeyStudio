import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { waNumber, message, fonnteToken } = await request.json();

    if (!waNumber || !message || !fonnteToken) {
      return NextResponse.json(
        { success: false, error: 'waNumber, message, and fonnteToken are required' },
        { status: 400 }
      );
    }

    // Clean up WA number (replace leading 0 with 62)
    let cleanNumber = waNumber.replace(/[^0-9]/g, "");
    if (cleanNumber.startsWith("0")) {
      cleanNumber = "62" + cleanNumber.substring(1);
    }

    // Send to Fonnte API
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
      return NextResponse.json({
        success: true,
        message: `Pesan berhasil dikirim ke ${cleanNumber}`
      });
    } else {
      return NextResponse.json({
        success: false,
        error: data.reason || 'Fonnte API error'
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Error sending WhatsApp message:", error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
}
