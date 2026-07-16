import { NextResponse } from 'next/server';
import { generateDynamicQris } from '@/lib/qris';

export async function POST(req: Request) {
  try {
    const { orderId, grossAmount, clientName, waNumber } = await req.json();
    const staticQris = process.env.CASHIFY_STATIC_QRIS;
    
    if (!staticQris) {
      return NextResponse.json({
        success: false,
        error: "CASHIFY_STATIC_QRIS is not configured in .env.local"
      }, { status: 500 });
    }

    // Generate dynamic QRIS string with amount and orderId
    const dynamicQris = generateDynamicQris(staticQris, grossAmount, orderId);

    return NextResponse.json({
      success: true,
      qrUrl: '', // Not used since we use QRCodeSVG on the client
      qrString: dynamicQris,
      transactionId: orderId,
      status: 'pending',
      isMock: process.env.NODE_ENV !== 'production' // Enable simulation button in dev
    });
  } catch (error: any) {
    console.error('Cashify QRIS Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
