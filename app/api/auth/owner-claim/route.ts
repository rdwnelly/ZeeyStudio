import { NextResponse } from 'next/server';
import { adminAuth, maskEmail, ownerEmails } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/auth/owner-claim   (Authorization: Bearer <ID token Owner>)
 *
 * Dipanggil setelah Owner login dengan email & kata sandi Firebase Auth.
 * Bila email tercantum di variabel lingkungan OWNER_EMAILS, server memberi
 * klaim { role: "owner" } yang dipakai Firestore Security Rules.
 * Email lain ditolak — mencegah akun Firebase Auth sembarang menjadi Owner.
 */
export async function POST(request: Request) {
  try {
    const header = request.headers.get('authorization') || '';
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!idToken) return NextResponse.json({ success: false, error: 'Token tidak ada' }, { status: 401 });

    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const email = (decoded.email || '').toLowerCase();
    const allowed = ownerEmails();

    if (!email || !allowed.includes(email)) {
      // Log tersamar untuk membantu diagnosis di Vercel → Logs
      console.warn(
        `[owner-claim] Ditolak: ${maskEmail(email || "(tanpa email)")} tidak ada di OWNER_EMAILS ` +
          `[${allowed.map(maskEmail).join(", ") || "kosong"}]`
      );
      return NextResponse.json(
        {
          success: false,
          error:
            allowed.length === 0
              ? 'OWNER_EMAILS belum diatur di server. Isi di Vercel → Settings → Environment Variables, lalu Redeploy.'
              : `Akun ${email || "ini"} tidak terdaftar sebagai Owner. Pastikan email ini tercantum persis di OWNER_EMAILS pada server (tanpa tanda kutip), lalu Redeploy.`,
        },
        { status: 403 }
      );
    }

    if (decoded.role === 'owner') {
      return NextResponse.json({ success: true, refresh: false });
    }

    const user = await auth.getUser(decoded.uid);
    await auth.setCustomUserClaims(decoded.uid, { ...(user.customClaims || {}), role: 'owner' });
    return NextResponse.json({ success: true, refresh: true });
  } catch (error: unknown) {
    console.error('owner-claim error:', error);
    return NextResponse.json({ success: false, error: 'Gagal memverifikasi akun Owner.' }, { status: 500 });
  }
}
