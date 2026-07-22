import { NextResponse } from 'next/server';
import { generateDynamicQris } from '@/lib/qris';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * Create QRIS via Casaku.id API (atau fallback ke generasi QRIS lokal)
 *
 * Mode A — Casaku API (penuh):
 *   Aktif jika CASAKU_QR_ID (UUID dari dashboard Casaku) sudah diisi.
 *   Casaku akan membuat transaksi QRIS dinamis di sistem mereka,
 *   lalu notifikasi HP diteruskan ke webhook kita.
 *
 * Mode B — Lokal (fallback):
 *   Aktif jika CASAKU_QR_ID masih kosong.
 *   QRIS statis dikonversi menjadi QRIS dinamis (amount tersemat)
 *   menggunakan `generateDynamicQris`. Webhook tetap dipakai
 *   untuk verifikasi otomatis saat notifikasi HP masuk di app Casaku.
 *
 * Docs API: https://casaku.id/docs#gen-v1
 */
export async function POST(req: Request) {
  try {
    const { orderId, grossAmount, clientName, waNumber } = await req.json();

    if (!orderId || !grossAmount) {
      return NextResponse.json(
        { success: false, error: 'orderId dan grossAmount wajib diisi' },
        { status: 400 }
      );
    }

    // ── 1. Baca konfigurasi dari Firestore settings (priority) atau env ────────
    let licenseKey   = process.env.CASAKU_LICENSE_KEY   || process.env.CASHIFY_API_KEY || '';
    let qrId         = process.env.CASAKU_QR_ID         || '';
    let staticQris   = process.env.CASAKU_STATIC_QRIS   || process.env.CASHIFY_STATIC_QRIS || '';

    const settingsSnap = await getDoc(doc(db, 'settings', 'payment'));
    if (settingsSnap.exists()) {
      const s = settingsSnap.data();
      if (s.casaku_license_key)  licenseKey  = s.casaku_license_key;
      if (s.casaku_qr_id)        qrId        = s.casaku_qr_id;
      if (s.qrisString)          staticQris  = s.qrisString;
    }

    // ── 2. Ekstrak projectId dari orderId (Format: INV-{projectId}-{timestamp}) ─
    const match = orderId.match(/^INV-(.+)-\d+$/);
    const projectId = match ? match[1] : null;

    // ── MODE A: Casaku API — hanya jika QR ID sudah ada ──────────────────────
    if (licenseKey && qrId) {
      const casakuPayload = {
        id: qrId,
        amount: grossAmount,
        useUniqueCode: false,
        // packageIds: e-wallet yang didukung QRIS ini (DANA adalah primary)
        packageIds: ['id.dana', 'com.gojek.app', 'id.co.mandiri.online', 'com.bri.brimo'],
        expiredInMinutes: 30,
        prefix: 'ZST',
      };

      const casakuRes = await fetch('https://api.casaku.id/api/generate/qris', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-license-key': licenseKey,
        },
        body: JSON.stringify(casakuPayload),
      });

      if (casakuRes.ok) {
        const casakuData = await casakuRes.json();
        console.log('[create-qris] Mode A — Casaku API response:', casakuData);

        if (projectId) {
          await updateDoc(doc(db, 'projects', projectId), {
            pendingPayment: {
              orderId,
              amount: grossAmount,
              casakuTransactionId: casakuData.transactionId || casakuData.id || null,
              mode: 'casaku-api',
              createdAt: new Date().toISOString(),
            },
          });
        }

        return NextResponse.json({
          success: true,
          qrString:      casakuData.qr_string || casakuData.qrString || casakuData.data?.qr_string || '',
          transactionId: casakuData.transactionId || casakuData.id || orderId,
          amount:        casakuData.finalAmount || casakuData.amount || grossAmount,
          status:        'pending',
          expiredAt:     casakuData.expiredAt || null,
          mode:          'casaku-api',
        });
      }

      // Casaku API error — log dan fallthrough ke Mode B
      const errText = await casakuRes.text().catch(() => '(no body)');
      console.warn(`[create-qris] Casaku API gagal (${casakuRes.status}), fallback ke QRIS lokal:`, errText);
    }

    // ── MODE B: Fallback — QRIS lokal ─────────────────────────────────────────
    // Dipakai jika: (a) CASAKU_QR_ID belum diisi, atau (b) Casaku API error
    if (!staticQris) {
      return NextResponse.json(
        {
          success: false,
          error:
            'QRIS belum dikonfigurasi. Masukkan QRIS String di Settings → Pembayaran, atau isi CASAKU_QR_ID untuk mode penuh.',
        },
        { status: 500 }
      );
    }

    console.log('[create-qris] Mode B — generasi QRIS lokal, amount:', grossAmount);
    const dynamicQris = generateDynamicQris(staticQris, grossAmount, orderId);

    if (projectId) {
      await updateDoc(doc(db, 'projects', projectId), {
        pendingPayment: {
          orderId,
          amount: grossAmount,
          casakuTransactionId: null, // tidak ada — verifikasi via webhook/amount-match
          mode: 'local-qris',
          createdAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      qrString:      dynamicQris,
      transactionId: orderId,
      amount:        grossAmount,
      status:        'pending',
      expiredAt:     null,
      mode:          'local-qris',
    });
  } catch (error: any) {
    console.error('[create-qris] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
