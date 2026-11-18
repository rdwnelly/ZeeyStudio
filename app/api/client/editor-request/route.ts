import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { loadProject } from '@/lib/client-project';

export const runtime = 'nodejs';

const MAX_PENDING_PER_PROJECT = 5;

/**
 * POST /api/client/editor-request  { projectId, notes }
 * Klien mengajukan permintaan edit; dibuat oleh server agar koleksi
 * editor_requests tidak perlu dibuka untuk penulisan publik.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const notes = String(body.notes || '').trim().slice(0, 2000);
    const project = await loadProject(String(body.projectId || ''));
    if (!project) return NextResponse.json({ success: false, error: 'Proyek tidak ditemukan' }, { status: 404 });
    if (!notes) return NextResponse.json({ success: false, error: 'Catatan permintaan wajib diisi' }, { status: 400 });

    const db = adminDb();
    const pending = await db.collection('editor_requests')
      .where('projectId', '==', project.id)
      .where('status', '==', 'Pending')
      .get();
    if (pending.size >= MAX_PENDING_PER_PROJECT) {
      return NextResponse.json({ success: false, error: 'Terlalu banyak permintaan yang belum diproses.' }, { status: 429 });
    }

    await db.collection('editor_requests').add({
      projectId: project.id,
      clientName: project.clientName,
      notes,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('client/editor-request error:', error);
    return NextResponse.json({ success: false, error: 'Gagal mengirim permintaan editor' }, { status: 500 });
  }
}
