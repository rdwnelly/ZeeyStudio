import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-cashify-signature') || req.headers.get('signature');

    // Secret HANYA dari variabel lingkungan server (tidak disimpan di Firestore)
    const secret = process.env.CASHIFY_WEBHOOK_SECRET || '';

    if (!secret) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    // Signature wajib & harus cocok — mencegah konfirmasi pembayaran palsu
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigOk = !!signature && (() => {
      try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
      } catch {
        return false;
      }
    })();
    if (!sigOk) {
      console.warn('Cashify webhook: signature tidak ada atau tidak cocok — ditolak.');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
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
      // (Sebelumnya mencari status "Proses" yang tidak pernah dipakai sistem.)
      const snapshot = await adminDb().collection('projects').where('status', '!=', 'Selesai').get();
      const candidates = snapshot.docs.filter(d => {
        const data = d.data() || {};
        return data.pendingPayment && Number(data.pendingPayment.amount) === Number(paymentAmount);
      });
      if (candidates.length === 1) projectId = candidates[0].id;
    }

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Could not map webhook to any projectId" }, { status: 400 });
    }

    // Update Firestore
    const projectRef = adminDb().collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();

    if (projectSnap.exists) {
      // Idempoten: jangan proses ulang / menurunkan status proyek yang sudah selesai
      const currentStatus = projectSnap.data()?.status;
      if (currentStatus === 'Selesai' || currentStatus === 'File Terkirim') {
        return NextResponse.json({ success: true, message: 'Project sudah Selesai' });
      }
      await projectRef.update({
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
