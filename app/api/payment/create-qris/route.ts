import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { createSnapClient, getMidtransConfig } from '@/lib/midtrans';

/**
 * Create Payment Request (Midtrans Snap)
 *
 * Membuat transaksi via Midtrans Snap API dan mengembalikan token Snap.
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

    // Ekstrak projectId dari orderId (Format: INV-{projectId}-{timestamp})
    const match = orderId.match(/^INV-(.+)-\d+$/);
    const projectId = match ? match[1] : null;

    // ── Midtrans Snap API ───────────────────────────────────────────────────
    try {
      const config = await getMidtransConfig();
      const snap = await createSnapClient();
      if (!snap || !config) {
        return NextResponse.json(
          {
            success: false,
            error: 'Midtrans belum dikonfigurasi. Silakan isi Server Key & Client Key di Settings Dashboard.',
          },
          { status: 400 }
        );
      }

      const midtransPayload = {
        transaction_details: {
          order_id: orderId,
          gross_amount: grossAmount,
        },
        customer_details: {
          first_name: clientName || 'Client',
          phone: waNumber || '',
        },
      };

      const transaction = await snap.createTransaction(midtransPayload);
      console.log('[create-payment] Midtrans Snap token:', transaction.token, 'isProduction:', config.isProduction);

      if (projectId) {
        await updateDoc(doc(db, 'projects', projectId), {
          pendingPayment: {
            orderId,
            amount: grossAmount,
            midtransToken: transaction.token,
            mode: 'midtrans-snap',
            createdAt: new Date().toISOString(),
          },
        });
      }

      return NextResponse.json({
        success: true,
        snapToken: transaction.token,
        snapUrl: transaction.redirect_url,
        clientKey: config.clientKey,
        isProduction: config.isProduction,
        transactionId: orderId,
        amount: grossAmount,
        status: 'pending',
        mode: 'midtrans-snap',
      });
    } catch (midtransError: any) {
      console.error('[create-payment] Midtrans API Gagal:', midtransError.message);
      return NextResponse.json(
        {
          success: false,
          isMidtransError: true,
          error: `Midtrans sedang dalam proses peninjauan/review bisnis: ${midtransError.message}`,
        },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error('[create-payment] Server error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

