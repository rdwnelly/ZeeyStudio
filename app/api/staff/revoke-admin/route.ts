import { NextResponse } from 'next/server';
import { adminAuth, verifyStaff } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/staff/revoke-admin  { adminId }   (khusus Owner)
 *
 * Mencabut sesi Firebase seorang admin (refresh token) setelah akunnya dihapus
 * atau hak aksesnya diubah. Tanpa ini, sesi custom token dapat terus diperbarui
 * tanpa batas. Setelah dicabut, token aktif berakhir ≤ 1 jam dan admin harus
 * login ulang (memperoleh klaim hak akses terbaru).
 */
export async function POST(request: Request) {
  if (!(await verifyStaff(request, { ownerOnly: true }))) {
    return NextResponse.json({ success: false, error: 'Hanya Owner' }, { status: 401 });
  }
  try {
    const { adminId } = await request.json();
    if (!adminId) return NextResponse.json({ success: false, error: 'adminId wajib' }, { status: 400 });
    await adminAuth().revokeRefreshTokens(`admin_${adminId}`);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Admin yang belum pernah login tidak memiliki akun Auth — tidak ada sesi untuk dicabut
    const code = (error as { code?: string })?.code;
    if (code === 'auth/user-not-found') return NextResponse.json({ success: true, noSession: true });
    console.error('revoke-admin error:', error);
    return NextResponse.json({ success: false, error: 'Gagal mencabut sesi' }, { status: 500 });
  }
}
