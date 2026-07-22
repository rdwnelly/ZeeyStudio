import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Cek status pembayaran transaksi QRIS via Casaku.id
 *
 * Pertama coba polling ke Casaku API check-status.
 * Jika Casaku tidak dikonfigurasi, fallback ke Firestore (status project).
 *
 * Docs: https://casaku.id/docs#check-status
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

    // ── 2. Baca konfigurasi Casaku dari Firestore settings atau env ─────────────
    let licenseKey = process.env.CASAKU_LICENSE_KEY || '';
    let casakuTransactionId: string | null = null;

    const settingsSnap = await getDoc(doc(db, 'settings', 'payment'));
    if (settingsSnap.exists()) {
      const s = settingsSnap.data();
      if (s.casaku_license_key) licenseKey = s.casaku_license_key;
    }

    // ── 3. Ambil casakuTransactionId dari pendingPayment Firestore ──────────────
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

    casakuTransactionId = projectData.pendingPayment?.casakuTransactionId || null;

    // ── 4. Polling status ke Casaku API jika ada transactionId & licenseKey ──────
    if (licenseKey && casakuTransactionId) {
      try {
        const casakuRes = await fetch('https://api.casaku.id/api/generate/check-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-license-key': licenseKey,
          },
          body: JSON.stringify({ transactionId: casakuTransactionId }),
        });

        if (casakuRes.ok) {
          const casakuData = await casakuRes.json();
          console.log('[payment-status] Casaku check-status:', casakuData);

          const casakuStatus = casakuData.status || casakuData.transaction_status || 'pending';

          // Casaku returns: pending | paid | cancel | expired
          if (casakuStatus === 'paid' || casakuStatus === 'PAID') {
            return NextResponse.json({ success: true, transaction_status: 'PAID' });
          } else if (casakuStatus === 'expired' || casakuStatus === 'cancel') {
            return NextResponse.json({ success: true, transaction_status: casakuStatus });
          }
        }
      } catch (casakuError) {
        // Jangan crash — fallback ke Firestore di bawah
        console.warn('[payment-status] Gagal polling Casaku, fallback ke Firestore:', casakuError);
      }
    }

    // ── 5. Fallback: cek status Firestore ──────────────────────────────────────
    return NextResponse.json({
      success: true,
      transaction_status: projectData.status === 'Selesai' ? 'PAID' : 'pending',
    });
  } catch (error: any) {
    console.error('[payment-status] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
