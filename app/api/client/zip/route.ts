export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Batas paket Hobby Vercel (Fluid compute): 300 detik, termasuk waktu streaming respons
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { PassThrough, Readable } from 'stream';
import { ZipArchive, type ArchiverError } from 'archiver';
import { loadProject } from '@/lib/client-project';
import { getDriveService } from '@/lib/drive';
import { planZipParts, resolveZipFiles, zipFileName } from '@/lib/zip-download';

/**
 * GET /api/client/zip?projectId=ID[&token=SUB][&plan=1 | &part=N]
 *
 * - plan=1 → JSON daftar bagian ZIP { parts: [{ part, count, bytes, url, fileName }] }
 * - part=N → unduhan ZIP bagian N, di-STREAM langsung dari Google Drive:
 *            tidak ditampung di memori, tidak terkena batas 4,5 MB respons Vercel,
 *            dan memakai pengelola unduhan bawaan browser (Android: Download,
 *            iPhone: app Files).
 *
 * Foto yang dimasukkan ditentukan server: pilihan klien yang sudah dibayar dan
 * benar-benar ada di folder Drive proyek.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId') || '';
  const token = url.searchParams.get('token');

  const project = await loadProject(projectId).catch(() => null);
  if (!project) return NextResponse.json({ success: false, error: 'Proyek tidak ditemukan' }, { status: 404 });

  let files;
  try {
    files = await resolveZipFiles(project, token);
  } catch (e) {
    console.error('[zip] gagal menyiapkan daftar foto:', e);
    return NextResponse.json({ success: false, error: 'Gagal membaca foto dari Google Drive' }, { status: 502 });
  }
  if (files.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Belum ada foto yang dapat diunduh (pembayaran belum selesai atau belum ada foto pilihan).' },
      { status: 403 }
    );
  }

  const parts = planZipParts(files);
  const base = `/api/client/zip?projectId=${encodeURIComponent(project.id)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;

  // ── Rencana unduhan ───────────────────────────────────────────────────────
  if (url.searchParams.get('plan')) {
    return NextResponse.json({
      success: true,
      totalCount: files.length,
      totalBytes: parts.reduce((a, p) => a + p.bytes, 0),
      parts: parts.map((p) => ({
        part: p.part,
        count: p.files.length,
        bytes: p.bytes,
        fileName: zipFileName(project.clientName, p.part, parts.length),
        url: `${base}&part=${p.part}`,
      })),
    });
  }

  // ── Unduhan ZIP (streaming) ───────────────────────────────────────────────
  const partNo = Math.max(1, Math.floor(Number(url.searchParams.get('part')) || 1));
  const part = parts[partNo - 1];
  if (!part) return NextResponse.json({ success: false, error: 'Bagian ZIP tidak ditemukan' }, { status: 404 });

  const drive = await getDriveService();
  // JPEG sudah terkompresi → mode "store" (tanpa kompresi ulang) agar cepat & hemat CPU
  const archive = new ZipArchive({ store: true });
  const output = new PassThrough();
  archive.pipe(output);
  archive.on('warning', (err: ArchiverError) => console.warn('[zip] peringatan:', err));
  archive.on('error', (err: ArchiverError) => {
    console.error('[zip] error:', err);
    output.destroy(err);
  });

  let aborted = false;
  request.signal.addEventListener('abort', () => {
    aborted = true;
    archive.abort();
  });

  // Ambil foto dari Drive satu per satu (berurutan) supaya memori & koneksi tetap kecil
  (async () => {
    const failed: string[] = [];
    for (const f of part.files) {
      if (aborted) return;
      try {
        const res = await drive.files.get(
          { fileId: f.id, alt: 'media', supportsAllDrives: true },
          { responseType: 'stream' }
        );
        // Tunggu entri ini selesai ditulis sebelum membuka foto berikutnya;
        // berhenti bila arsip error / dibatalkan agar tidak menggantung sampai batas waktu
        const done = new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            archive.off('entry', onEntry);
            archive.off('error', onError);
          };
          const onEntry = () => { cleanup(); resolve(); };
          const onError = (err: Error) => { cleanup(); reject(err); };
          archive.once('entry', onEntry);
          archive.once('error', onError);
        });
        archive.append(res.data as unknown as Readable, { name: f.name });
        await done;
      } catch (e) {
        if (aborted) return;
        console.warn(`[zip] lewati ${f.id}:`, e instanceof Error ? e.message : e);
        failed.push(f.name);
      }
    }
    if (failed.length) {
      archive.append(
        `Foto berikut gagal diambil dari Google Drive saat membuat ZIP ini:\n\n${failed.join('\n')}\n\n` +
          'Silakan unduh ulang atau hubungi studio.',
        { name: 'BACA-SAYA_foto-gagal.txt' }
      );
    }
    await archive.finalize();
  })().catch((e) => {
    console.error('[zip] gagal:', e);
    archive.abort();
  });

  const fileName = zipFileName(project.clientName, part.part, parts.length);
  return new Response(Readable.toWeb(output) as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
