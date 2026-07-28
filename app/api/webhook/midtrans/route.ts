import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getMidtransConfig } from '@/lib/midtrans';

/**
 * Midtrans Webhook Endpoint
 *
 * Menerima notifikasi dari Midtrans (status pembayaran).
 * Perlu diverifikasi dengan signature key SHA512.
 *
 * Docs: https://docs.midtrans.com/reference/webhooks
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log('[midtrans-webhook] Payload diterima:', JSON.stringify(payload));

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = payload;

    // ── 1. Ambil Server Key Midtrans ──────────────────────────────────────────
    const config = await getMidtransConfig();
    if (!config || !config.serverKey) {
      console.error('[midtrans-webhook] Server Key tidak dikonfigurasi');
      return NextResponse.json({ error: 'Konfigurasi Midtrans tidak ditemukan' }, { status: 500 });
    }

    // ── 2. Verifikasi Signature Key ───────────────────────────────────────────
    // SHA512(order_id + status_code + gross_amount + server_key)
    const hashData = `${order_id}${status_code}${gross_amount}${config.serverKey}`;
    const calculatedSignature = crypto.createHash('sha512').update(hashData).digest('hex');

    if (calculatedSignature !== signature_key) {
      console.warn('[midtrans-webhook] Invalid signature_key');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // ── 3. Cek Status Pembayaran ──────────────────────────────────────────────
    let isSuccess = false;

    if (transaction_status === 'capture') {
      if (fraud_status === 'accept') {
        isSuccess = true;
      }
    } else if (transaction_status === 'settlement') {
      isSuccess = true;
    }

    if (!isSuccess) {
      console.log(`[midtrans-webhook] Status bukan sukses (${transaction_status}). Diabaikan.`);
      return NextResponse.json({ success: true, message: `Ignored status: ${transaction_status}` });
    }

    // ── 4. Ekstrak projectId dari order_id ────────────────────────────────────
    const match = order_id.match(/^INV-(.+)-\d+$/);
    const projectId = match ? match[1] : null;

    if (!projectId) {
      console.error('[midtrans-webhook] Format order_id tidak valid:', order_id);
      return NextResponse.json({ error: 'Format order_id tidak valid' }, { status: 400 });
    }

    // ── 5. Update Firestore ───────────────────────────────────────────────────
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      return NextResponse.json({ error: 'Project tidak ditemukan' }, { status: 404 });
    }

    // Idempotency: cek jika sudah Selesai
    const projectData = projectSnap.data();
    if (projectData.status === 'Selesai') {
       return NextResponse.json({ success: true, message: 'Project sudah Selesai' });
    }

    await updateDoc(projectRef, {
      status: 'Selesai',
      paymentInfo: {
        method: payload.payment_type || 'Midtrans',
        amount: Number(gross_amount),
        paidAt: payload.settlement_time || payload.transaction_time || new Date().toISOString(),
        transactionId: payload.transaction_id,
        rawWebhook: payload,
      },
      completedAt: new Date().toISOString(),
    });

    console.log(`[midtrans-webhook] ✅ Project "${projectId}" berhasil diupdate ke Selesai`);
    return NextResponse.json({ success: true, message: 'Berhasil update status pembayaran' });
  } catch (error: any) {
    console.error('[midtrans-webhook] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
