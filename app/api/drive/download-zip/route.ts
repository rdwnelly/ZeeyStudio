import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/drive';
import JSZip from 'jszip';

// Force Node.js runtime for Google Drive API access
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/drive/download-zip
 * Body: { photos: [{ id: string, name: string }], clientName: string }
 *
 * Builds a ZIP archive SERVER-SIDE and returns it as a binary response.
 * The browser sees Content-Disposition: attachment and immediately records
 * the download in its native download history — no client-side waiting.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const photos: { id: string; name: string }[] = body.photos || [];
    const clientName: string = body.clientName || 'Klien';

    if (photos.length === 0) {
      return NextResponse.json({ error: 'Tidak ada foto untuk diunduh' }, { status: 400 });
    }

    const drive = await getDriveService();
    const zip = new JSZip();

    // Download all photos from Google Drive and add to ZIP
    // Batched in groups of 5 for parallel efficiency
    const batchSize = 5;
    for (let i = 0; i < photos.length; i += batchSize) {
      const batch = photos.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (photo) => {
          try {
            const res = await drive.files.get(
              { fileId: photo.id, alt: 'media', supportsAllDrives: true },
              { responseType: 'stream' }
            );
            const buf = await streamToBuffer(res.data as NodeJS.ReadableStream);
            zip.file(photo.name, buf);
          } catch (e) {
            console.error(`Skip foto gagal: ${photo.name} (${photo.id})`, e);
            // Don't abort — skip failed files and continue
          }
        })
      );
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 }, // Fast, minimal compression
    });

    const safeClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Foto_${safeClientName}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.byteLength),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Download ZIP error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal membuat ZIP' },
      { status: 500 }
    );
  }
}

/** Convert a Node.js Readable stream to a Buffer */
function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
