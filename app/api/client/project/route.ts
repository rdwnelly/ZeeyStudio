export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { loadPriceList, loadProject, toClientView } from '@/lib/client-project';
import { getMidtransConfig } from '@/lib/midtrans';
import { getQrisSetup } from '@/lib/qris-payment';

export const runtime = 'nodejs';

/**
 * GET /api/client/project?id=PROJECT_ID
 *
 * Data awal galeri klien dalam satu permintaan: proyek (versi aman),
 * daftar harga, info pembayaran publik, dan nomor WA studio.
 * Pengganti akses Firestore langsung dari browser.
 */
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    const project = await loadProject(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Proyek tidak ditemukan' }, { status: 404 });
    }

    const db = adminDb();
    const [priceList, paymentSnap, profileSnap] = await Promise.all([
      loadPriceList(),
      db.collection('settings').doc('payment').get(),
      db.collection('settings').doc('profile').get(),
    ]);

    // Hanya bagian publik: rekening transfer (Firestore) + Client Key Midtrans (env server)
    const pay = paymentSnap.exists ? paymentSnap.data() || {} : {};
    const [midtrans, qris] = await Promise.all([getMidtransConfig(), getQrisSetup()]);
    const payment = {
      bankName: pay.bankName || '',
      accountNumber: pay.accountNumber || '',
      accountName: pay.accountName || '',
      midtransClientKey: midtrans?.clientKey || '',
      midtransIsProduction: midtrans ? midtrans.isProduction : undefined,
      // QRIS langsung ke merchant (QR DANA Bisnis) — metode utama bila diatur
      qrisEnabled: qris.enabled,
      qrisAutoVerify: qris.autoVerify,
      qrisMerchantName: qris.merchantName,
    };

    // Nomor WA studio: profil → admin yang menangani proyek → admin mana pun
    let studioWa: string = (profileSnap.exists && profileSnap.data()?.waNumber) || '';
    if (!studioWa) {
      const handlers = [project.assignedAdmin, project.createdBy].filter(Boolean);
      const admins = await db.collection('admins').get();
      let anyWa = '';
      admins.forEach((d) => {
        const a = d.data();
        if (!a.waNumber) return;
        if (!studioWa && (handlers.includes(a.name) || handlers.includes(a.username))) studioWa = a.waNumber;
        if (!anyWa) anyWa = a.waNumber;
      });
      studioWa = studioWa || anyWa;
    }

    return NextResponse.json({ success: true, project: toClientView(project), priceList, payment, studioWa });
  } catch (error: unknown) {
    console.error('client/project error:', error);
    return NextResponse.json({ success: false, error: 'Gagal memuat data galeri' }, { status: 500 });
  }
}
