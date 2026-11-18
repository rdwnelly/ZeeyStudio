import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { hashPassword, verifyPassword } from '@/lib/password';

export const runtime = 'nodejs';

/**
 * POST /api/auth/admin-login  { username, password }
 *
 * 1. Verifikasi kata sandi admin (hash PBKDF2) memakai Admin SDK.
 *    Akun lama berkata sandi teks biasa dimigrasikan ke hash saat login berhasil.
 * 2. Menerbitkan Firebase custom token dengan klaim { role: "admin", accesses, adminName }.
 *    Browser login dengan signInWithCustomToken, sehingga Firestore Security Rules
 *    dapat memeriksa peran & hak akses dari request.auth.token.
 */
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username dan kata sandi wajib diisi.' }, { status: 400 });
    }

    const db = adminDb();
    const snap = await db.collection('admins').where('username', '==', String(username)).get();

    for (const d of snap.docs) {
      const a = d.data();
      let ok = false;

      if (a.passwordHash && a.passwordSalt) {
        ok = verifyPassword(String(password), a.passwordHash, a.passwordSalt);
      } else if (typeof a.password === 'string' && a.password === String(password)) {
        ok = true;
        await d.ref.update({ ...hashPassword(String(password)), password: FieldValue.delete() });
      }

      if (ok) {
        const role = a.role || 'admin';
        const accesses: string[] = Array.isArray(a.accesses)
          ? a.accesses
          : role === 'admin_editor' ? ['editor', 'portfolio'] : ['bookings', 'portfolio'];
        const name: string = a.name || a.username;

        const customToken = await adminAuth().createCustomToken(`admin_${d.id}`, {
          role: 'admin',
          accesses,
          adminName: name,
        });
        return NextResponse.json({ success: true, name, accesses, customToken });
      }
    }

    return NextResponse.json({ success: false, error: 'Username atau password salah.' }, { status: 401 });
  } catch (error: unknown) {
    console.error('admin-login error:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan saat menghubungi server.' }, { status: 500 });
  }
}
