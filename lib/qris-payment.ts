/**
 * Pembayaran QRIS langsung ke merchant (mis. QR DANA Bisnis) — HANYA untuk server.
 *
 * Mode:
 *  - "qris-midtrans": QRIS dinamis resmi diterbitkan Midtrans (Core API) per transaksi.
 *                     Verifikasi OTOMATIS via HTTP Notification (SHA512) / cek status.
 *                     Tidak perlu kode unik — dicocokkan lewat order_id.
 *  - "qris-self"    : cadangan bila Midtrans belum diatur / gagal. QRIS dinamis dibuat dari
 *                     QR statis (mis. DANA Bisnis) + kode unik 1–999; diverifikasi admin (1-klik).
 */
import { adminDb } from "@/lib/firebase-admin";
import { generateDynamicQris, getQrisInfo } from "@/lib/qris";
import { createMidtransQris, getMidtransConfig } from "@/lib/midtrans";

export const QRIS_EXPIRY_MINUTES = 30;

export type PendingQrisPayment = {
  orderId: string;
  mode: "qris-midtrans" | "qris-self";
  amount: number; // nominal yang harus dibayar (termasuk kode unik)
  baseAmount: number; // tagihan sebelum kode unik
  uniqueCode: number;
  qrString: string;
  merchantName: string;
  midtransTransactionId?: string;
  qrUrl?: string;
  createdAt: string;
  expiresAt: string;
};

/** QR statis merchant: Pengaturan (settings/payment.qrisStatic) atau env QRIS_STATIC. */
export async function getStaticQris(): Promise<string> {
  const snap = await adminDb().collection("settings").doc("payment").get();
  const fromDb = (snap.data()?.qrisStatic as string) || "";
  return (fromDb || process.env.QRIS_STATIC || "").trim();
}

export async function getQrisSetup() {
  const staticQris = await getStaticQris();
  const info = staticQris ? getQrisInfo(staticQris) : null;
  const midtrans = await getMidtransConfig();
  const midtransQris = !!midtrans && process.env.MIDTRANS_QRIS_ENABLED !== "false";
  return {
    enabled: !!(info?.valid || midtransQris),
    autoVerify: midtransQris,
    merchantName: info?.merchantName || "",
    staticQris: info?.valid ? staticQris : "",
    midtransQris,
  };
}

function isActive(p?: PendingQrisPayment | null) {
  return !!p && (p.mode === "qris-midtrans" || p.mode === "qris-self") && new Date(p.expiresAt).getTime() > Date.now();
}

/** Pilih kode unik 1–999 yang belum dipakai tagihan QRIS aktif lain dengan nominal dasar sama. */
async function pickUniqueCode(baseAmount: number, excludeProjectId: string): Promise<number> {
  const snap = await adminDb().collection("projects").where("pendingPayment.mode", "==", "qris-self").get();
  const used = new Set<number>();
  snap.docs.forEach((d) => {
    const p = d.data().pendingPayment as PendingQrisPayment | undefined;
    if (d.id !== excludeProjectId && isActive(p)) used.add(p!.amount);
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = 1 + Math.floor(Math.random() * 999);
    if (!used.has(baseAmount + code)) return code;
  }
  for (let code = 1; code <= 999; code++) if (!used.has(baseAmount + code)) return code;
  throw new Error("Terlalu banyak tagihan QRIS aktif dengan nominal yang sama. Coba lagi beberapa menit lagi.");
}

/**
 * Buat (atau pakai ulang) tagihan QRIS untuk proyek. Tagihan aktif dengan nominal dasar
 * yang sama dipakai ulang agar klien tidak mendapat kode unik berbeda setiap membuka invoice.
 */
export type QrisCustomer = { name: string; email?: string; phone?: string; itemName: string };

export async function createOrReuseQrisPayment(
  projectId: string,
  baseAmount: number,
  existing: PendingQrisPayment | null | undefined,
  customer: QrisCustomer
): Promise<PendingQrisPayment> {
  if (isActive(existing) && existing!.baseAmount === baseAmount && (existing!.qrString || existing!.qrUrl)) return existing!;

  const setup = await getQrisSetup();
  if (!setup.enabled) throw new Error("Pembayaran QRIS belum diatur oleh studio.");

  const now = Date.now();
  const orderId = `INV-${projectId}-${now}`;

  let payment: PendingQrisPayment | null = null;
  let midtransError = "";

  if (setup.midtransQris) {
    try {
      const trx = await createMidtransQris({
        orderId,
        amount: baseAmount,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        itemName: customer.itemName,
        expiresInMinutes: QRIS_EXPIRY_MINUTES,
      });
      payment = {
        orderId,
        mode: "qris-midtrans",
        amount: baseAmount,
        baseAmount,
        uniqueCode: 0,
        qrString: trx.qrString,
        qrUrl: trx.qrUrl,
        merchantName: trx.qrString ? getQrisInfo(trx.qrString).merchantName : "",
        midtransTransactionId: trx.transactionId,
        createdAt: new Date(now).toISOString(),
        expiresAt: trx.expiresAt || new Date(now + QRIS_EXPIRY_MINUTES * 60000).toISOString(),
      };
    } catch (e) {
      // Akun/QRIS Midtrans belum aktif dsb. → pakai QR DANA Bisnis bila tersedia
      midtransError = e instanceof Error ? e.message : String(e);
      console.warn("[qris] Midtrans QRIS gagal, beralih ke QR statis:", midtransError);
    }
  }

  if (!payment) {
    if (!setup.staticQris) throw new Error(midtransError || "Pembayaran QRIS belum diatur oleh studio.");
    const uniqueCode = await pickUniqueCode(baseAmount, projectId);
    const amount = baseAmount + uniqueCode;
    payment = {
      orderId,
      mode: "qris-self",
      amount,
      baseAmount,
      uniqueCode,
      qrString: generateDynamicQris(setup.staticQris, amount),
      merchantName: setup.merchantName,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + QRIS_EXPIRY_MINUTES * 60000).toISOString(),
    };
  }

  await adminDb().collection("projects").doc(projectId).update({ pendingPayment: payment });
  return payment;
}

/**
 * Tandai proyek lunas (dipakai webhook & cek status). Idempoten: proyek yang
 * sudah Selesai / File Terkirim tidak diubah.
 */
export async function markProjectPaid(
  projectId: string,
  info: { method: string; amount: number; transactionId?: string; paidAt?: string }
): Promise<"updated" | "already"> {
  const ref = adminDb().collection("projects").doc(projectId);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const status = snap.data()?.status;
    if (status === "Selesai" || status === "File Terkirim") return "already";
    const now = new Date().toISOString();
    tx.update(ref, {
      status: "Selesai",
      paymentInfo: {
        method: info.method,
        amount: info.amount,
        paidAt: info.paidAt || now,
        transactionId: info.transactionId || "",
      },
      completedAt: now,
    });
    return "updated";
  });
}
