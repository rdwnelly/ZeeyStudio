import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { getMidtransConfig } from '@/lib/midtrans';
import { markProjectPaid } from '@/lib/qris-payment';

export const runtime = 'nodejs';

/**
 * Midtrans Webhook Endpoint
 *
 * Menerima notifikasi dari Midtrans (status pembayaran).
 * Diverifikasi dengan signature key SHA512.
 *
 * Docs: https://docs.midtrans.com/reference/webhooks
 */
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = payload;

    // ── 1. Ambil Server Key Midtrans ──────────────────────────────────────────
    const config = await getMidtransConfig();
    if (!config || !config.serverKey) {
      console.error('[midtrans-webhook] Server key tidak ditemukan');
      return NextResponse.json({ error: 'Konfigurasi Midtrans tidak ditemukan' }, { status: 500 });
    }

    // ── 2. Verifikasi Signature Key: SHA512(order_id + status_code + gross_amount + server_key)
    const hashData = `${order_id}${status_code}${gross_amount}${config.serverKey}`;
    const calculatedSignature = crypto.createHash('sha512').update(hashData).digest('hex');
    if (calculatedSignature !== signature_key) {
      console.warn('[midtrans-webhook] Signature tidak valid!');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // ── 3. Cek Status Pembayaran ──────────────────────────────────────────────
    const isSuccess =
      (transaction_status === 'capture' && fraud_status === 'accept') || transaction_status === 'settlement';
    if (!isSuccess) {
      return NextResponse.json({ success: true, message: `Ignored status: ${transaction_status}` });
    }

    // ── 4. Ekstrak projectId dari order_id (INV-{projectId}-{timestamp}) ──────
    const match = String(order_id).match(/^INV-(.+)-\d+$/);
    const projectId = match ? match[1] : null;
    if (!projectId) {
      return NextResponse.json({ error: 'Format order_id tidak valid' }, { status: 400 });
    }

    // ── 5. Tandai lunas (transaksional & idempoten) ───────────────────────────
    const projectSnap = await adminDb().collection('projects').doc(projectId).get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: 'Project tidak ditemukan' }, { status: 404 });
    }
    const result = await markProjectPaid(projectId, {
      method: payload.payment_type === 'qris' ? `QRIS ${payload.issuer || ''} (Midtrans)`.replace('  ', ' ') : payload.payment_type || 'Midtrans',
      amount: Number(gross_amount),
      transactionId: payload.transaction_id || '',
      paidAt: payload.settlement_time ? new Date(String(payload.settlement_time).replace(' ', 'T') + '+07:00').toISOString() : undefined,
    });
    if (result === 'already') {
      return NextResponse.json({ success: true, message: 'Project sudah Selesai' });
    }

    return NextResponse.json({ success: true, message: 'Berhasil update status pembayaran' });
  } catch (error: unknown) {
    console.error('[midtrans-webhook] Error:', error);
    return NextResponse.json({ success: false, error: 'Webhook error' }, { status: 500 });
  }
}
