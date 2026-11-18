export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { billFor, findSubToken, isLocked, loadPriceList, loadProject, DONE_STATUSES } from '@/lib/client-project';
import { createOrReuseQrisPayment, markProjectPaid, type PendingQrisPayment } from '@/lib/qris-payment';
import { getMidtransStatus } from '@/lib/midtrans';

export const runtime = 'nodejs';

function toClient(p: PendingQrisPayment) {
  return {
    orderId: p.orderId,
    amount: p.amount,
    baseAmount: p.baseAmount,
    uniqueCode: p.uniqueCode,
    qrString: p.qrString,
    merchantName: p.merchantName,
    expiresAt: p.expiresAt,
    qrUrl: p.qrUrl || '',
    autoVerify: p.mode === 'qris-midtrans',
  };
}

/**
 * POST /api/payment/qris  { projectId, token? }
 * Membuat tagihan QRIS dengan nominal yang dihitung server dari pilihan foto
 * yang tersimpan — lewat QRIS Midtrans (verifikasi otomatis) atau, sebagai cadangan,
 * QR DANA Bisnis statis + kode unik (verifikasi admin).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const project = await loadProject(String(body.projectId || ''));
    if (!project) return NextResponse.json({ success: false, error: 'Proyek tidak ditemukan' }, { status: 404 });
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

    const existing = (project as unknown as { pendingPayment?: PendingQrisPayment }).pendingPayment;
    const payment = await createOrReuseQrisPayment(project.id, bill.grandTotal, existing, {
      name: project.clientName,
      email: (project as unknown as { clientEmail?: string }).clientEmail,
      phone: project.waNumber,
      itemName: `Foto ${project.packageName || 'Zeey Studio'}`,
    });
    return NextResponse.json({ success: true, payment: toClient(payment) });
  } catch (error: unknown) {
    console.error('payment/qris POST error:', error);
    const message = error instanceof Error ? error.message : 'Gagal membuat QRIS';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/payment/qris?projectId=
 * Cek pelunasan. Bila transaksi dibuat lewat Midtrans dan notifikasi belum masuk,
 * server menanyakan status langsung ke Midtrans (cadangan bila notifikasi tertunda).
 */
export async function GET(req: Request) {
  try {
    const projectId = new URL(req.url).searchParams.get('projectId') || '';
    const project = await loadProject(projectId);
    if (!project) return NextResponse.json({ success: false, error: 'Proyek tidak ditemukan' }, { status: 404 });
    if (DONE_STATUSES.includes(project.status || '')) return NextResponse.json({ success: true, paid: true });

    const p = (project as unknown as { pendingPayment?: PendingQrisPayment }).pendingPayment;
    if (p?.mode === 'qris-midtrans' && p.orderId) {
      const trx = await getMidtransStatus(p.orderId).catch(() => null);
      const settled = trx && (trx.status === 'settlement' || (trx.status === 'capture' && trx.fraudStatus !== 'deny'));
      if (settled && trx.grossAmount >= p.baseAmount) {
        await markProjectPaid(project.id, { method: 'QRIS (Midtrans)', amount: trx.grossAmount, transactionId: p.midtransTransactionId || p.orderId });
        return NextResponse.json({ success: true, paid: true });
      }
      return NextResponse.json({ success: true, paid: false, status: trx?.status || 'unknown' });
    }
    return NextResponse.json({ success: true, paid: false });
  } catch (error: unknown) {
    console.error('payment/qris GET error:', error);
    return NextResponse.json({ success: false, error: 'Gagal memeriksa pembayaran' }, { status: 500 });
  }
}
