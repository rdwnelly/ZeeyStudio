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

    // Simulasikan delay jaringan ke API Pihak Ketiga (misal Fonnte/Twilio)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Pada implementasi asli, di sini kita akan melakukan fetch() ke API Fonnte/Twilio
    // Contoh:
    // await fetch("https://api.fonnte.com/send", { ... })

    return NextResponse.json({
      success: true,
      message: `Pesan pengingat berhasil dikirim ke ${clientName} (${waNumber})`
    });
  } catch (error: any) {
    console.error("Error sending WhatsApp reminder:", error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan internal server' },
      { status: 500 }
    );
  }
}
