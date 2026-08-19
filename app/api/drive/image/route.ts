export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/drive';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const sz = searchParams.get('sz') || 's400'; // Default to s400 (lightweight thumbnail) for fast response

    if (!id) {
      return new NextResponse('Missing id', { status: 400 });
    }

    const drive = await getDriveService();

    // If full resolution is explicitly requested for download/export
    if (sz === 'full' || sz === 'media') {
      const response = await drive.files.get(
        { fileId: id, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      );
      const headers = new Headers();
      headers.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new NextResponse(response.data as any, { status: 200, headers });
    }

    // Default: fetch thumbnail metadata and proxy small compressed image (~25-50KB)
    try {
      const fileMeta = await drive.files.get({
        fileId: id,
        fields: 'thumbnailLink',
        supportsAllDrives: true,
      });

      const baseThumb = fileMeta.data.thumbnailLink;
      if (baseThumb) {
        const targetSize = sz.startsWith('s') ? sz : `s${sz}`;
        const thumbUrl = baseThumb
          .replace(/=s\d+(-c)?$/, `=${targetSize}`)
          .replace(/=w\d+-h\d+(-c)?$/, `=${targetSize}`)
          .replace(/=s\d+/, `=${targetSize}`);

        const imgRes = await fetch(thumbUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const headers = new Headers();
          headers.set('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          return new NextResponse(buffer, { status: 200, headers });
        }
      }
    } catch (thumbErr) {
      console.warn(`Notice: Could not fetch thumbnail for ${id}, falling back to full media`, thumbErr);
    }

    // Fallback to media stream if thumbnail fetching fails
    const response = await drive.files.get(
      { fileId: id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );
    const headers = new Headers();
    headers.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new NextResponse(response.data as any, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('Image proxy error:', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}

