/**
 * Midtrans Snap Client — Singleton
 *
 * Membaca konfigurasi dari Firestore settings/payment (priority) → env var (fallback).
 * Menggunakan `midtrans-client` yang sudah terinstall di project.
 *
 * Docs: https://docs.midtrans.com/reference/snap-api
 */
import midtransClient from 'midtrans-client';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export type MidtransConfig = {
  serverKey: string;
  clientKey: string;
  merchantId: string;
  isProduction: boolean;
};

/**
 * Ambil konfigurasi Midtrans dari Firestore settings, fallback ke env var.
 * Return null jika Server Key tidak dikonfigurasi sama sekali.
 */
export async function getMidtransConfig(): Promise<MidtransConfig | null> {
  let serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  let clientKey = process.env.MIDTRANS_CLIENT_KEY || '';
  let merchantId = process.env.MIDTRANS_MERCHANT_ID || '';
  let isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

  // Smart auto-detection from key prefix if env var was not explicitly set
  if (!isProduction && (serverKey.startsWith('Mid-server-') || clientKey.startsWith('Mid-client-'))) {
    isProduction = true;
  }

  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'payment'));
    if (settingsSnap.exists()) {
      const s = settingsSnap.data();
      if (s.midtrans_server_key) serverKey = s.midtrans_server_key;
      if (s.midtrans_client_key) clientKey = s.midtrans_client_key;
      if (s.midtrans_merchant_id) merchantId = s.midtrans_merchant_id;
      if (typeof s.midtrans_is_production === 'boolean') {
        isProduction = s.midtrans_is_production;
      } else if (serverKey.startsWith('Mid-server-') || clientKey.startsWith('Mid-client-')) {
        isProduction = true;
      }
    }
  } catch (e) {
    console.warn('[midtrans] Gagal baca Firestore settings, fallback ke env var:', e);
  }

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
