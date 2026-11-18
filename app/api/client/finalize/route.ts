import { NextResponse } from 'next/server';
import {
  DONE_STATUSES, billFor, finalizeSelection, findSubToken, isLocked, loadPriceList, loadProject, sanitizeAddons, sanitizeSelection,
} from '@/lib/client-project';
import { createSnapClient } from '@/lib/midtrans';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/client/finalize
 * Body: { projectId, token?, selectedPhotoIds, selectedAddons, orderId? }
 *
 * Mengunci pilihan foto klien menjadi final. Server HANYA mengizinkan bila:
 *  1. tagihan yang dihitung server = Rp0, atau
 *  2. pembayaran Midtrans untuk orderId milik proyek ini sudah settlement/capture
 *     dengan nominal ≥ tagihan, atau
 *  3. proyek sudah ditandai lunas oleh webhook / verifikasi admin.
 * Sebelumnya status "Selesai" ditulis langsung dari browser sehingga dapat dipalsukan.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = await loadProject(String(body.projectId || ''));
    if (!project) return NextResponse.json({ success: false, error: 'Proyek tidak ditemukan' }, { status: 404 });

    const sub = findSubToken(project, body.token);
    if (isLocked(project, sub)) {
      return NextResponse.json({ success: true, alreadyFinal: true });
    }

    const priceList = await loadPriceList();
    const selectedIds = sanitizeSelection(body.selectedPhotoIds);
    const addons = sanitizeAddons(body.selectedAddons, priceList);
    const bill = billFor(project, sub, selectedIds.length, addons, priceList);

    let paid = bill.grandTotal === 0;

    // Sudah dilunasi lewat webhook atau disetujui admin (transfer manual)
    if (!paid && (DONE_STATUSES.includes(project.status || '') || project.paymentProofStatus === 'verified')) {
      const snap = await adminDb().collection('projects').doc(project.id).get();
      const paidAmount = Number(snap.data()?.paymentInfo?.amount);
      paid = !Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount >= bill.grandTotal;
    }

    // Verifikasi langsung ke Midtrans
    const orderId = String(body.orderId || '');
    if (!paid && orderId.startsWith(`INV-${project.id}-`)) {
      try {
        const snap = await createSnapClient();
        if (snap) {
          const st = await snap.transaction.status(orderId);
          const ok = st.transaction_status === 'settlement' || (st.transaction_status === 'capture' && st.fraud_status !== 'deny');
          paid = ok && Number(st.gross_amount) >= bill.grandTotal;
        }
      } catch (e) {
        console.warn('finalize: cek status Midtrans gagal', e);
      }
    }

    if (!paid) {
      return NextResponse.json({ success: false, error: 'Pembayaran belum terverifikasi.', grandTotal: bill.grandTotal }, { status: 402 });
    }

    await finalizeSelection(project, sub, selectedIds, addons, bill.totalExtraCost);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('client/finalize error:', error);
    return NextResponse.json({ success: false, error: 'Gagal menyelesaikan pemilihan foto' }, { status: 500 });
  }
}
