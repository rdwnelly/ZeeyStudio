import { NextResponse } from 'next/server';
import { adminDb, verifyStaff } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/staff/commission  { projectId }   (Authorization: Bearer <ID token staf>)
 *
 * Mencatat komisi fotografer ke koleksi expenses saat proyek ditutup (File Terkirim).
 * Dijalankan di server karena data komisi admin & pengeluaran hanya boleh dibaca Owner
 * menurut Firestore Security Rules. Idempoten: satu proyek = satu catatan komisi
 * (ID dokumen tetap `komisi_{projectId}`).
 */
export async function POST(request: Request) {
  try {
    const staff = await verifyStaff(request);
    if (!staff) return NextResponse.json({ success: false, error: 'Tidak diizinkan' }, { status: 401 });

    const { projectId } = await request.json();
    const db = adminDb();
    const projectSnap = await db.collection('projects').doc(String(projectId || '')).get();
    if (!projectSnap.exists) return NextResponse.json({ success: false, error: 'Proyek tidak ditemukan' }, { status: 404 });

    const project = projectSnap.data() || {};
    if (project.status !== 'File Terkirim' || !project.assignedAdmin) {
      return NextResponse.json({ success: true, recorded: false, reason: 'Proyek belum ditutup atau tanpa fotografer' });
    }

    const adminSnap = await db.collection('admins').where('name', '==', project.assignedAdmin).limit(1).get();
    const commission = Number(adminSnap.docs[0]?.data().commission) || 0;
    if (commission <= 0) {
      return NextResponse.json({ success: true, recorded: false, reason: 'Fotografer tidak memiliki komisi' });
    }

    const description = `Komisi - ${project.assignedAdmin} (ID: ${projectSnap.id.slice(-4)})`;

    // Catatan lama (sebelum ada projectId) dicek lewat deskripsi
    const legacy = await db.collection('expenses')
      .where('category', '==', 'Komisi Tim')
      .where('description', '==', description)
      .get();
    if (legacy.docs.some((d) => !d.data().projectId || d.data().projectId === projectSnap.id)) {
      return NextResponse.json({ success: true, recorded: false, reason: 'Komisi sudah tercatat' });
    }

    try {
      await db.collection('expenses').doc(`komisi_${projectSnap.id}`).create({
        description,
        projectId: projectSnap.id,
        amount: commission,
        category: 'Komisi Tim',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Dokumen sudah ada → komisi sudah tercatat sebelumnya
      return NextResponse.json({ success: true, recorded: false, reason: 'Komisi sudah tercatat' });
    }

    await db.collection('audit_logs').add({
      user: 'Sistem',
      role: 'system',
      action: 'Payroll Otomatis',
      details: `Komisi Rp${commission.toLocaleString('id-ID')} ditambahkan untuk ${project.assignedAdmin}`,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, recorded: true, amount: commission });
  } catch (error: unknown) {
    console.error('staff/commission error:', error);
    return NextResponse.json({ success: false, error: 'Gagal mencatat komisi' }, { status: 500 });
  }
}
