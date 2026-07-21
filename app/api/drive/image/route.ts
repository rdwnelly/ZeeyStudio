import { NextResponse } from 'next/server';
import { getDriveService } from '@/lib/drive';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

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
