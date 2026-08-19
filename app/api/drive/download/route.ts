export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/drive';

export const runtime = 'nodejs';

/**
 * GET /api/drive/download?id=FILE_ID&name=filename.jpg
 *
 * Proxy endpoint that streams a Google Drive file directly to the browser
 * with Content-Disposition: attachment so the browser's native download
 * manager picks it up immediately — no waiting for a ZIP to be built.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const name = searchParams.get('name') || 'foto.jpg';

    if (!id) {
      return new NextResponse('Missing id', { status: 400 });
    }

    const drive = await getDriveService();
    const response = await drive.files.get(
      { fileId: id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    const headers = new Headers();
    headers.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    headers.set('Cache-Control', 'private, max-age=3600');
    // This header tells the browser to download the file instead of displaying it
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);

    // Pass through Content-Length if available so the browser shows download progress
    if (response.headers['content-length']) {
      headers.set('Content-Length', response.headers['content-length']);
    }

    return new NextResponse(response.data as any, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Download proxy error:', error);
    return new NextResponse('Error fetching file', { status: 500 });
  }
}
