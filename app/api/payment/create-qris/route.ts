import { NextResponse } from 'next/server';
const midtransClient = require('midtrans-client');

export async function POST(req: Request) {
  try {
    const { orderId, grossAmount, clientName, waNumber } = await req.json();
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    
    // If no real API key is provided, we return a mock success response so the app doesn't break
    if (!serverKey || serverKey === 'YOUR_MIDTRANS_SERVER_KEY') {
      return NextResponse.json({
        success: true,
        qrString: "MOCK_QR_STRING_FOR_TESTING_" + orderId, // A mock QR string that qrcode.react will render
        transactionId: "mock-" + orderId,
        status: "pending",
        isMock: true
      });
    }

    const coreApi = new midtransClient.CoreApi({
      isProduction: false,
      serverKey: serverKey,
      clientKey: process.env.MIDTRANS_CLIENT_KEY || ''
    });

    const parameter = {
      payment_type: "qris",
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount
      },
      customer_details: {
        first_name: clientName,
        phone: waNumber
      }
    };

    const response = await coreApi.charge(parameter);
    
    let qrUrl = '';
    if (response.actions && response.actions.length > 0) {
      const generateQrAction = response.actions.find((action: any) => action.name === 'generate-qr-code');
      if (generateQrAction) {
        qrUrl = generateQrAction.url;
      }
    }

    return NextResponse.json({
      success: true,
      qrUrl: qrUrl,
      qrString: response.qr_string,
      transactionId: response.transaction_id,
      status: response.transaction_status,
      isMock: false
    });
  } catch (error: any) {
    console.error('Midtrans Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
