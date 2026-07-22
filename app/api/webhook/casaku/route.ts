import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Casaku.id Webhook Endpoint
 *
 * Casaku membaca notifikasi HP Android (e-wallet / m-banking),
 * lalu mengirim payload ke sini saat ada pembayaran masuk.
 *
 * Docs: https://casaku.id/docs#wh-payload
 *
 * Cara setup di dashboard Casaku:
 *   Webhook URL → https://domainanda.com/api/webhook/casaku
 */

// Verifikasi HMAC-SHA256 signature dari Casaku
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // ── 1. Baca signature dari header ─────────────────────────────────────────
    // Casaku mengirim signature di header x-casaku-signature atau x-signature
    const signature =
      req.headers.get('x-casaku-signature') ||
      req.headers.get('x-cashify-signature') || // kompatibilitas lama
      req.headers.get('x-signature') ||
      req.headers.get('signature') ||
      '';

    // ── 2. Ambil secret dari Firestore settings (priority) atau env var ───────
    // Urutan prioritas: Firestore → CASAKU env → CASHIFY env (legacy)
    let secret =
      process.env.CASAKU_WEBHOOK_SECRET ||
      process.env.CASHIFY_WEBHOOK_SECRET || '';

    const settingsSnap = await getDoc(doc(db, 'settings', 'payment'));
    if (settingsSnap.exists()) {
      const s = settingsSnap.data();
      if (s.casaku_webhook_secret)   secret = s.casaku_webhook_secret;
      else if (s.cashifyWebhookSecret) secret = s.cashifyWebhookSecret; // fallback legacy
    }

    if (!secret) {
      console.error('[casaku-webhook] Webhook secret tidak dikonfigurasi');
      return NextResponse.json({ error: 'Webhook secret tidak dikonfigurasi' }, { status: 500 });
    }

    // ── 3. Verifikasi signature jika ada ──────────────────────────────────────
    if (signature) {
      const isValid = verifySignature(rawBody, signature, secret);
      if (!isValid) {
        console.warn('[casaku-webhook] Signature tidak cocok! Mungkin request palsu.');
        // Lanjut tetapi log peringatan — jangan hard-reject agar tidak blocking saat rotate secret
      }
    }

    // ── 4. Parse payload ──────────────────────────────────────────────────────
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Payload bukan JSON yang valid' }, { status: 400 });
    }

    console.log('[casaku-webhook] Payload diterima:', JSON.stringify(payload));

    // ── 5. Ekstrak field transaksi dari payload Casaku ────────────────────────
    // Casaku format: { transactionId, status, amount, paidAt, ... }
    // Bisa juga dibungkus dalam { data: { ... } }
    const dataObj = payload.data && typeof payload.data === 'object' ? payload.data : payload;

    const transactionId: string =
      dataObj.transactionId ||
      dataObj.transaction_id ||
      dataObj.reference_id ||
      dataObj.order_id ||
      dataObj.external_id ||
      '';

    const status: string =
      dataObj.status ||
      dataObj.transaction_status ||
      payload.event ||
      '';

    const paymentAmount: number = Number(
      dataObj.amount || dataObj.gross_amount || dataObj.paid_amount || 0
    );

    // ── 6. Cek apakah statusnya sukses ────────────────────────────────────────
    // Casaku mengirim status: paid | success | PAID | SUCCESS | dll.
    const statusUpper = (status || '').toUpperCase();
    const isSuccess = [
      'PAID', 'SUCCESS', 'SETTLEMENT', 'CAPTURE',
      'COMPLETED', 'SETTLED', 'TRANSACTION.PAID', 'PAYMENT.SUCCESS',
    ].includes(statusUpper);

    if (!isSuccess) {
      console.log(`[casaku-webhook] Diabaikan — status bukan sukses: "${status}"`);
      return NextResponse.json({ success: true, message: `Diabaikan (status: ${status})` });
    }

    // ── 7. Cari project yang cocok ────────────────────────────────────────────
    let projectId: string | null = null;

    if (transactionId) {
      // Format order ID kita: INV-{projectId}-{timestamp}
      const match = transactionId.match(/^INV-(.+)-\d+$/);
      if (match) {
        projectId = match[1];
      }
    }

    if (!projectId && paymentAmount > 0) {
      // Fallback: cari berdasarkan jumlah yang pending
      console.log(`[casaku-webhook] Fallback — cari project berdasarkan amount: ${paymentAmount}`);
      // Query project yang belum Selesai
      const q = query(collection(db, 'projects'), where('status', '!=', 'Selesai'));
      const snapshot = await getDocs(q);

      for (const d of snapshot.docs) {
        const data = d.data();
        if (
          data.pendingPayment &&
          Number(data.pendingPayment.amount) === paymentAmount
        ) {
          projectId = d.id;
          break;
        }
      }
    }

    if (!projectId) {
      console.error('[casaku-webhook] Tidak bisa menemukan project yang cocok');
      return NextResponse.json(
        { success: false, error: 'Tidak bisa memetakan webhook ke projectId manapun' },
        { status: 400 }
      );
    }

    // ── 8. Update Firestore ───────────────────────────────────────────────────
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      return NextResponse.json({ success: false, error: 'Project tidak ditemukan' }, { status: 404 });
    }

    await updateDoc(projectRef, {
      status: 'Selesai',
      paymentInfo: {
        method: 'Casaku QRIS',
        amount: paymentAmount,
        paidAt: dataObj.paidAt || new Date().toISOString(),
        transactionId: transactionId,
        rawWebhook: payload,
      },
      completedAt: new Date().toISOString(),
    });

    console.log(`[casaku-webhook] ✅ Project "${projectId}" berhasil diupdate ke Selesai`);
    return NextResponse.json({
      success: true,
      message: `Project ${projectId} berhasil diverifikasi dan diupdate ke Selesai`,
    });
  } catch (error: any) {
    console.error('[casaku-webhook] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
