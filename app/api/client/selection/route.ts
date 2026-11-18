import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  billFor, findSubToken, isLocked, loadPriceList, loadProject, sanitizeAddons, sanitizeSelection,
} from '@/lib/client-project';

export const runtime = 'nodejs';

/**
 * POST /api/client/selection
 * Body: { projectId, token?, selectedPhotoIds, selectedAddons, proofPending? }
 *
 * Menyimpan pilihan foto & layanan tambahan sebelum pembayaran (tanpa mengubah status).
 * Bila proofPending = true, menandai bahwa klien sudah konfirmasi transfer manual.
 * Tagihan dihitung ulang di server.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const project = await loadProject(String(body.projectId || ''));
    if (!project) return NextResponse.json({ success: false, error: 'Proyek tidak ditemukan' }, { status: 404 });

    const sub = findSubToken(project, body.token);
    if (isLocked(project, sub)) {
      return NextResponse.json({ success: false, error: 'Galeri sudah dikunci karena pemilihan telah selesai.' }, { status: 409 });
    }

    const priceList = await loadPriceList();
    const selectedIds = sanitizeSelection(body.selectedPhotoIds);
    const addons = sanitizeAddons(body.selectedAddons, priceList);
    const bill = billFor(project, sub, selectedIds.length, addons, priceList);

    const update: Record<string, unknown> = {
      extraRevenue: bill.totalExtraCost,
      selectedAddons: addons,
    };
    if (sub && project.subTokens?.length) {
      // Mode sub-token: simpan ke sub-token miliknya, jangan timpa pilihan anggota lain
      update.subTokens = project.subTokens.map((st) => (st.id === sub.id ? { ...st, selectedPhotoIds: selectedIds } : st));
    } else {
      update.selectedPhotoIds = selectedIds;
    }
    if (body.proofPending === true) update.paymentProofStatus = 'pending';

    await adminDb().collection('projects').doc(project.id).update(update);
    return NextResponse.json({ success: true, bill });
  } catch (error: unknown) {
    console.error('client/selection error:', error);
    return NextResponse.json({ success: false, error: 'Gagal menyimpan pilihan foto' }, { status: 500 });
  }
}
