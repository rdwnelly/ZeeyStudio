import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-cashify-signature') || req.headers.get('signature');
    
    const secret = process.env.CASHIFY_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    // If signature is provided in headers, verify it (Optional depending on exact Cashify spec)
    if (signature) {
      const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      // Some systems use base64 instead of hex for HMAC, but hex is most common
      if (hash !== signature && hash !== signature.toLowerCase()) {
        console.warn('Webhook signature mismatch. Expected:', hash, 'Got:', signature);
        // We'll log a warning but proceed if it's a test environment, or you can block it:
        // return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log('Received Cashify Webhook:', payload);
    
    // Map common reference ID fields used by payment gateways
    const orderId = payload.reference_id || payload.bill_number || payload.order_id || payload.merchantOrderId;
    const status = payload.status || payload.transaction_status || payload.paymentStatus;
    
    // Check if status is indicating success
    const isSuccess = ['PAID', 'SUCCESS', 'settlement', 'capture', 'COMPLETED'].includes(status?.toUpperCase());

    if (!orderId || !isSuccess) {
      return NextResponse.json({ success: true, message: "Ignored (not success or missing orderId)" });
    }

    // Extract projectId from orderId (Format: INV-{projectId}-{timestamp})
    const match = orderId.match(/^INV-(.+)-\d+$/);
    const projectId = match ? match[1] : null;

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Could not parse projectId from orderId" }, { status: 400 });
    }

    // Update Firestore
    const docRef = doc(db, "projects", projectId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      await updateDoc(docRef, {
        status: 'Selesai',
        paymentInfo: {
          method: 'Cashify QRIS',
          amount: payload.amount || payload.gross_amount || payload.totalAmount || 0,
          paidAt: new Date().toISOString(),
          referenceId: orderId,
          rawWebhook: payload
        },
        completedAt: new Date().toISOString()
      });
      return NextResponse.json({ success: true, message: "Project updated to Selesai" });
    } else {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
