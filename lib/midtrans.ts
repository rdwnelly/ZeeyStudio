/**
 * Midtrans Snap Client — Singleton
 *
 * Membaca konfigurasi dari variabel lingkungan server (lihat getMidtransConfig).
 * Menggunakan `midtrans-client` yang sudah terinstall di project.
 *
 * Docs: https://docs.midtrans.com/reference/snap-api
 */
import midtransClient from 'midtrans-client';

export type MidtransConfig = {
  serverKey: string;
  clientKey: string;
  merchantId: string;
  isProduction: boolean;
};

/**
 * Ambil konfigurasi Midtrans HANYA dari variabel lingkungan server:
 *   MIDTRANS_SERVER_KEY (rahasia), MIDTRANS_CLIENT_KEY, MIDTRANS_MERCHANT_ID,
 *   MIDTRANS_IS_PRODUCTION ("true"/"false"; bila kosong dideteksi dari awalan kunci).
 * Kunci tidak lagi dibaca dari Firestore agar tidak tersimpan di basis data.
 * Return null jika Server Key belum diatur.
 */
export async function getMidtransConfig(): Promise<MidtransConfig | null> {
  const serverKey = (process.env.MIDTRANS_SERVER_KEY || '').trim();
  const clientKey = (process.env.MIDTRANS_CLIENT_KEY || '').trim();
  const merchantId = (process.env.MIDTRANS_MERCHANT_ID || '').trim();

  const explicit = process.env.MIDTRANS_IS_PRODUCTION;
  const isProduction =
    explicit === 'true' ? true
    : explicit === 'false' ? false
    : serverKey.startsWith('Mid-server-') || clientKey.startsWith('Mid-client-');

  if (!serverKey) return null;
  return { serverKey, clientKey, merchantId, isProduction };
}

/**
 * Buat instance Midtrans Snap client.
 * Return null jika konfigurasi tidak lengkap.
 */
export async function createSnapClient(): Promise<any> {
  const config = await getMidtransConfig();
  if (!config) return null;

  return new midtransClient.Snap({
    isProduction: config.isProduction,
    serverKey: config.serverKey,
    clientKey: config.clientKey,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// QRIS via Core API (https://docs.midtrans.com/reference/qris)
// QR ditampilkan langsung di galeri (bukan popup Snap). Pelunasan dikonfirmasi
// lewat HTTP Notification ke /api/webhook/midtrans (signature SHA512) dan,
// sebagai cadangan, GET /v2/{order_id}/status.
// ─────────────────────────────────────────────────────────────────────────────

function midtransApiBase(isProduction: boolean): string {
  return (process.env.MIDTRANS_API_BASE || (isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com')).replace(/\/$/, '');
}

function basicAuth(serverKey: string): string {
  return 'Basic ' + Buffer.from(`${serverKey}:`).toString('base64');
}

/** "2023-01-05 11:01:39" (WIB, GMT+7) → ISO 8601 */
function wibToIso(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value.replace(' ', 'T') + '+07:00');
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export type MidtransQris = {
  transactionId: string;
  qrString: string;
  qrUrl: string;
  expiresAt?: string;
};

export async function createMidtransQris(input: {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  itemName: string;
  expiresInMinutes: number;
}): Promise<MidtransQris> {
  const cfg = await getMidtransConfig();
  if (!cfg) throw new Error('Midtrans belum dikonfigurasi');
  const amount = Math.round(input.amount);

  const res = await fetch(`${midtransApiBase(cfg.isProduction)}/v2/charge`, {
    method: 'POST',
    headers: { Authorization: basicAuth(cfg.serverKey), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      payment_type: 'qris',
      transaction_details: { order_id: input.orderId, gross_amount: amount },
      item_details: [{ id: 'foto', price: amount, quantity: 1, name: input.itemName.slice(0, 50) }],
      customer_details: {
        first_name: input.customerName.slice(0, 50) || 'Klien',
        ...(input.customerEmail ? { email: input.customerEmail } : {}),
        ...(input.customerPhone ? { phone: input.customerPhone } : {}),
      },
      qris: { acquirer: (process.env.MIDTRANS_QRIS_ACQUIRER || 'gopay').trim() },
      custom_expiry: { expiry_duration: input.expiresInMinutes, unit: 'minute' },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (String(json.status_code) !== '201' || json.transaction_status !== 'pending') {
    throw new Error(String(json.status_message || `Midtrans HTTP ${res.status}`));
  }
  const actions = (json.actions as Array<{ name?: string; url?: string }>) || [];
  return {
    transactionId: String(json.transaction_id || ''),
    qrString: String(json.qr_string || ''),
    qrUrl: actions.find((a) => a.name === 'generate-qr-code')?.url || actions[0]?.url || '',
    expiresAt: wibToIso(String(json.expire_time || json.expiry_time || '')),
  };
}

/** Status transaksi (GET /v2/{order_id}/status). */
export async function getMidtransStatus(orderId: string): Promise<{ status: string; fraudStatus: string; grossAmount: number } | null> {
  const cfg = await getMidtransConfig();
  if (!cfg || !orderId) return null;
  const res = await fetch(`${midtransApiBase(cfg.isProduction)}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Authorization: basicAuth(cfg.serverKey), Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!json.transaction_status) return null;
  return {
    status: String(json.transaction_status).toLowerCase(),
    fraudStatus: String(json.fraud_status || '').toLowerCase(),
    grossAmount: Number(json.gross_amount) || 0,
  };
}
