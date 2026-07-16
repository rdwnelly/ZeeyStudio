import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ success: false, error: "orderId is required" }, { status: 400 });
    }

    // Extract project ID from orderId (Format: INV-{projectId}-{timestamp})
    // E.g. INV-john-jane-1b2c-1700000000000 -> we need "john-jane-1b2c"
    const match = orderId.match(/^INV-(.+)-\d+$/);
    const projectId = match ? match[1] : null;

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Invalid orderId format" }, { status: 400 });
    }

    // Check status in Firestore
    const docRef = doc(db, "projects", projectId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return NextResponse.json({
        success: true,
        // If status is 'Selesai', it means payment was successful. 
        // Cashify Webhook sets this to 'Selesai' or client sets it if simulating.
        transaction_status: data.status === 'Selesai' ? 'PAID' : 'pending' 
      });
    } else {
      return NextResponse.json({ success: true, transaction_status: 'not_found' });
    }
  } catch (error: any) {
    console.error('Status Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
