import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { verifyStaff } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/auth/hash-password  { password }
 * Menghasilkan { passwordHash, passwordSalt } untuk disimpan pada akun admin,
 * sehingga kata sandi tidak pernah tersimpan sebagai teks biasa.
 */
export async function POST(request: Request) {
  try {
    if (!(await verifyStaff(request, { ownerOnly: true }))) {
      return NextResponse.json({ error: 'Hanya Owner yang dapat mengelola akun admin.' }, { status: 401 });
    }
    const { password } = await request.json();
    if (!password || String(password).length < 4) {
      return NextResponse.json({ error: 'Kata sandi minimal 4 karakter.' }, { status: 400 });
    }
    return NextResponse.json(hashPassword(String(password)));
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }
}
