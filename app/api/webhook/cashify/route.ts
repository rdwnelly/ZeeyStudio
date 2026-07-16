import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-cashify-signature') || req.headers.get('signature');

    // Default to env var, but override if configured in Settings
    let secret = process.env.CASHIFY_WEBHOOK_SECRET;
    
    const settingsSnap = await getDoc(doc(db, "settings", "payment"));
    if (settingsSnap.exists()) {
      const settingsData = settingsSnap.data();
      if (settingsData.cashifyWebhookSecret) {
        secret = settingsData.cashifyWebhookSecret;
      }
    }

    if (!secret) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    // If signature is provided in headers, verify it
    if (signature) {
      const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      if (hash !== signature && hash !== signature.toLowerCase()) {
        console.warn('Webhook signature mismatch. Expected:', hash, 'Got:', signature);
      }
    }

    const payload = JSON.parse(rawBody);
    console.log('Received Cashify Webhook:', payload);

    // Some gateways wrap the actual transaction object in a 'data' property
    const dataObj = payload.data && typeof payload.data === 'object' ? payload.data : payload;

    // Map common reference ID fields used by payment gateways
    const orderId = dataObj.reference_id || dataObj.bill_number || dataObj.order_id || dataObj.merchantOrderId || dataObj.external_id;
    const status = dataObj.status || dataObj.transaction_status || dataObj.paymentStatus || payload.event;
    const paymentAmount = dataObj.amount || dataObj.gross_amount || dataObj.totalAmount || dataObj.paid_amount || 0;

    // Check if status is indicating success
    const isSuccess = ['PAID', 'SUCCESS', 'SETTLEMENT', 'CAPTURE', 'COMPLETED', 'SETTLED', 'TRANSACTION.PAID', 'PAYMENT.SUCCESS'].includes(status?.toUpperCase());

    if (!isSuccess) {
      return NextResponse.json({ success: true, message: `Ignored (not success status: ${status})` });
    }

    let projectId: string | null = null;

    if (orderId) {
      // Extract projectId from orderId (Format: INV-{projectId}-{timestamp})
      const match = orderId.match(/^INV-(.+)-\d+$/);
      projectId = match ? match[1] : null;
    }

    if (!projectId && paymentAmount) {
      // Fallback: Find project by pending payment amount
      const q = query(collection(db, "projects"), where("status", "==", "Proses"));
      const snapshot = await getDocs(q);
      
      for (const d of snapshot.docs) {
        const data = d.data();
        if (data.pendingPayment && Number(data.pendingPayment.amount) === Number(paymentAmount)) {
          projectId = d.id;
          break;
        }
      }
    }

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Could not map webhook to any projectId" }, { status: 400 });
    }

    // Update Firestore
    const projectRef = doc(db, "projects", projectId);
    const projectSnap = await getDoc(projectRef);

    if (projectSnap.exists()) {
      await updateDoc(projectRef, {
        status: 'Selesai',
        paymentInfo: {
          method: 'Cashify QRIS',
          amount: paymentAmount,
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
