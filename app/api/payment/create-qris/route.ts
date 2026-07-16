import { NextResponse } from 'next/server';
import { generateDynamicQris } from '@/lib/qris';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { orderId, grossAmount, clientName, waNumber } = await req.json();
    
    // Default to env var, but override if configured in Settings
    let staticQris = process.env.CASHIFY_STATIC_QRIS;
    
    const docSnap = await getDoc(doc(db, "settings", "payment"));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.qrisString) {
        staticQris = data.qrisString;
      }
    }
    
    if (!staticQris) {
      return NextResponse.json({
        success: false,
        error: "QRIS String is not configured in Settings"
      }, { status: 500 });
    }

    // Extract projectId from orderId
    const match = orderId.match(/^INV-(.+)-\d+$/);
    const projectId = match ? match[1] : null;

    if (projectId) {
      // Save pending payment info to Firestore so webhook can find it by amount
      await updateDoc(doc(db, "projects", projectId), {
        pendingPayment: {
          orderId,
          amount: grossAmount,
          createdAt: new Date().toISOString()
        }
      });
    }

    // Generate dynamic QRIS string with amount and orderId
    const dynamicQris = generateDynamicQris(staticQris, grossAmount, orderId);

    return NextResponse.json({
      success: true,
      qrUrl: '', // Not used since we use QRCodeSVG on the client
      qrString: dynamicQris,
      transactionId: orderId,
      status: 'pending',
      isMock: false // Mode Simulasi Dimatikan, sekarang berjalan secara nyata
    });
  } catch (error: any) {
    console.error('Cashify QRIS Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
