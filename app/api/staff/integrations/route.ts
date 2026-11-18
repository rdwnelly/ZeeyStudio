export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, verifyStaff } from '@/lib/firebase-admin';
import { getMidtransConfig } from '@/lib/midtrans';
import { getDriveCredentials } from '@/lib/drive';
import { getQrisSetup } from '@/lib/qris-payment';
import { getQrisInfo } from '@/lib/qris';

export const runtime = 'nodejs';

/** Field rahasia lama yang dulu disimpan di Firestore dan kini tidak dipakai lagi. */
const LEGACY_PAYMENT_FIELDS = [
  'midtrans_server_key', 'midtrans_client_key', 'midtrans_merchant_id', 'midtrans_is_production',
  'casaku_webhook_secret', 'cashifyWebhookSecret',
];
const LEGACY_GDRIVE_FIELDS = ['client_email', 'private_key', 'service_account_json'];

function mask(value: string): string {
  if (!value) return '';
  return value.length <= 10 ? '••••' : `${value.slice(0, 8)}••••${value.slice(-4)}`;
}

async function legacyStatus() {
  const db = adminDb();
  const [paySnap, driveSnap] = await Promise.all([
    db.collection('settings').doc('payment').get(),
    db.collection('settings').doc('gdrive').get(),
  ]);
  const pay = paySnap.data() || {};
  const drive = driveSnap.data() || {};
  return {
    payment: LEGACY_PAYMENT_FIELDS.filter((f) => pay[f] !== undefined && pay[f] !== ''),
    gdrive: LEGACY_GDRIVE_FIELDS.filter((f) => drive[f] !== undefined && drive[f] !== ''),
  };
}

/**
 * GET /api/staff/integrations  (khusus Owner)
 * Status konfigurasi kunci di variabel lingkungan server — nilai rahasia TIDAK dikembalikan.
 */
export async function GET(request: Request) {
  if (!(await verifyStaff(request, { ownerOnly: true }))) {
    return NextResponse.json({ error: 'Hanya Owner' }, { status: 401 });
  }
  const midtrans = await getMidtransConfig();
  const drive = getDriveCredentials();
  const qris = await getQrisSetup();
  const qrisInfo = qris.staticQris ? getQrisInfo(qris.staticQris) : null;
  return NextResponse.json({
    midtrans: {
      configured: !!midtrans,
      isProduction: midtrans?.isProduction ?? false,
      clientKey: mask(midtrans?.clientKey || ''),
      hasClientKey: !!midtrans?.clientKey,
      merchantId: midtrans?.merchantId || '',
    },
    drive: {
      configured: !!drive,
      clientEmail: drive?.client_email || '', // perlu ditampilkan untuk berbagi folder "ZeeyStudio"
    },
    qris: {
      configured: !!qris.staticQris,
      merchantName: qrisInfo?.merchantName || '',
      merchantCity: qrisInfo?.merchantCity || '',
      nmid: qrisInfo?.nmid || '',
      autoVerify: qris.autoVerify,
    },
    midtransQris: {
      enabled: qris.midtransQris,
      acquirer: (process.env.MIDTRANS_QRIS_ACQUIRER || 'gopay').trim(),
    },
    webhooks: {
      cashify: !!process.env.CASHIFY_WEBHOOK_SECRET,
    },
    legacyInFirestore: await legacyStatus(),
  });
}

/**
 * POST /api/staff/integrations  { action: "purge-legacy" }  (khusus Owner)
 * Menghapus kunci rahasia lama yang tersisa di Firestore (settings/payment & settings/gdrive).
 * Data rekening transfer manual tidak disentuh.
 */
export async function POST(request: Request) {
  if (!(await verifyStaff(request, { ownerOnly: true }))) {
    return NextResponse.json({ error: 'Hanya Owner' }, { status: 401 });
  }
  const { action } = await request.json().catch(() => ({}));
  if (action !== 'purge-legacy') {
    return NextResponse.json({ error: 'Aksi tidak dikenal' }, { status: 400 });
  }
  const db = adminDb();
  const payRef = db.collection('settings').doc('payment');
  if ((await payRef.get()).exists) {
    await payRef.update(Object.fromEntries(LEGACY_PAYMENT_FIELDS.map((f) => [f, FieldValue.delete()])));
  }
  await db.collection('settings').doc('gdrive').delete();
  await db.collection('audit_logs').add({
    user: 'Owner',
    role: 'owner',
    action: 'Keamanan',
    details: 'Menghapus kunci Midtrans/Drive/webhook lama dari database (kini hanya di variabel lingkungan)',
    timestamp: new Date().toISOString(),
  });
  return NextResponse.json({ success: true, legacyInFirestore: await legacyStatus() });
}
