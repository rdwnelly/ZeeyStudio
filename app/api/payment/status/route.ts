import { NextResponse } from 'next/server';
const midtransClient = require('midtrans-client');

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    const isMock = searchParams.get('isMock');

    if (!orderId) {
      return NextResponse.json({ success: false, error: "orderId is required" }, { status: 400 });
    }

    if (isMock === 'true') {
      // Simulate that the mock payment always succeeds after a few seconds of polling (handled by client simulation usually, but just in case)
      // Actually, for mock, the client can just simulate payment.
      return NextResponse.json({
        success: true,
        transaction_status: "pending" // Let client handle the simulation
      });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey || serverKey === 'YOUR_MIDTRANS_SERVER_KEY') {
      return NextResponse.json({ success: false, error: "Server key not configured" }, { status: 500 });
    }

    const coreApi = new midtransClient.CoreApi({
      isProduction: false,
      serverKey: serverKey,
      clientKey: process.env.MIDTRANS_CLIENT_KEY || ''
    });

    const statusResponse = await coreApi.transaction.status(orderId);

    return NextResponse.json({
      success: true,
      transaction_status: statusResponse.transaction_status, // e.g., 'settlement', 'pending', 'expire'
      fraud_status: statusResponse.fraud_status
    });
  } catch (error: any) {
    console.error('Midtrans Status Error:', error);
    // If order not found, Midtrans returns 404
    if (error.httpStatusCode === 404) {
      return NextResponse.json({ success: true, transaction_status: 'not_found' });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
