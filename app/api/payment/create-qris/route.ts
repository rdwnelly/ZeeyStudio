import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { createSnapClient, getMidtransConfig } from '@/lib/midtrans';
import { billFor, findSubToken, isLocked, loadPriceList, loadProject } from '@/lib/client-project';

export const runtime = 'nodejs';

/**
 * Create Payment Request (Midtrans Snap)
 * Body: { projectId, token? }
 *
 * Nominal tagihan DIHITUNG DI SERVER dari pilihan foto & layanan tambahan yang
 * sudah disimpan (POST /api/client/selection), bukan dari angka kiriman browser.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const project = await loadProject(String(body.projectId || ''));
    if (!project) {
      return NextResponse.json({ success: false, error: 'Proyek tidak ditemukan' }, { status: 404 });
    }
    const sub = findSubToken(project, body.token);
    if (isLocked(project, sub)) {
      return NextResponse.json({ success: false, error: 'Pemilihan foto sudah selesai.' }, { status: 409 });
    }

    const priceList = await loadPriceList();
    const selected = sub ? sub.selectedPhotoIds || [] : project.selectedPhotoIds || [];
    const bill = billFor(project, sub, selected.length, project.selectedAddons || {}, priceList);
    if (bill.grandTotal <= 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada tagihan yang perlu dibayar.' }, { status: 400 });
    }

    const orderId = `INV-${project.id}-${Date.now()}`;

    // ── Midtrans Snap API ───────────────────────────────────────────────────
    try {
      const config = await getMidtransConfig();
      const snap = await createSnapClient();
      if (!snap || !config) {
        return NextResponse.json(
          { success: false, error: 'Midtrans belum dikonfigurasi. Atur MIDTRANS_SERVER_KEY & MIDTRANS_CLIENT_KEY di Environment Variables server.' },
          { status: 400 }
        );
      }

      const transaction = await snap.createTransaction({
        transaction_details: { order_id: orderId, gross_amount: bill.grandTotal },
        customer_details: { first_name: project.clientName || 'Client', phone: project.waNumber || '' },
      });

      await adminDb().collection('projects').doc(project.id).update({
        pendingPayment: {
          orderId,
          amount: bill.grandTotal,
          midtransToken: transaction.token,
          mode: 'midtrans-snap',
          createdAt: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        snapToken: transaction.token,
        snapUrl: transaction.redirect_url,
        clientKey: config.clientKey,
        isProduction: config.isProduction,
        transactionId: orderId,
        orderId,
        amount: bill.grandTotal,
        status: 'pending',
        mode: 'midtrans-snap',
      });
    } catch (midtransError: unknown) {
      const message = midtransError instanceof Error ? midtransError.message : String(midtransError);
      console.error('[Midtrans Snap] Error:', message);
      return NextResponse.json(
        { success: false, isMidtransError: true, error: `Midtrans sedang dalam proses peninjauan/review bisnis: ${message}` },
        { status: 200 }
      );
    }
  } catch (error: unknown) {
    console.error('Create Payment Error:', error);
    return NextResponse.json({ success: false, error: 'Gagal membuat pembayaran' }, { status: 500 });
  }
}
