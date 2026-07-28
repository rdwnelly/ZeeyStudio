import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { createSnapClient } from '@/lib/midtrans';

/**
 * Cek status pembayaran transaksi Midtrans
 *
 * Docs Midtrans: https://docs.midtrans.com/reference/get-transaction-status
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId wajib diisi' }, { status: 400 });
    }

    // ── 1. Ekstrak projectId dari orderId (Format: INV-{projectId}-{timestamp}) ─
    const match = orderId.match(/^INV-(.+)-\d+$/);
    const projectId = match ? match[1] : null;

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'Format orderId tidak valid' }, { status: 400 });
    }

    // ── 2. Ambil data project dari Firestore ─────────────────────────────────────
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      return NextResponse.json({ success: true, transaction_status: 'not_found' });
    }

    const projectData = projectSnap.data();

    // Jika project sudah Selesai (diupdate oleh webhook), langsung return PAID
    if (projectData.status === 'Selesai') {
      return NextResponse.json({ success: true, transaction_status: 'PAID' });
    }

    // ── 3. Polling status ke Midtrans API ────────────────────────────────────────
    try {
      const snap = await createSnapClient();
      if (snap) {
        const midtransRes = await snap.transaction.status(orderId);
        console.log('[payment-status] Midtrans check-status:', midtransRes.transaction_status);

        const status = midtransRes.transaction_status;
        if (status === 'settlement' || status === 'capture') {
          return NextResponse.json({ success: true, transaction_status: 'PAID' });
        } else if (status === 'expire' || status === 'cancel' || status === 'deny') {
          return NextResponse.json({ success: true, transaction_status: status });
        } else {
          return NextResponse.json({ success: true, transaction_status: 'pending' });
        }
      }
    } catch (midtransError: any) {
      // Status 404 dari Midtrans berarti transaksi belum dibayar (atau belum tercatat penuh)
      if (!midtransError.message?.includes('404')) {
        console.warn('[payment-status] Gagal polling Midtrans:', midtransError.message);
      }
    }

    // ── 4. Fallback: cek status Firestore ────────────────────────────────────────
    return NextResponse.json({
      success: true,
      transaction_status: projectData.status === 'Selesai' ? 'PAID' : 'pending',
    });
  } catch (error: any) {
    console.error('[payment-status] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

