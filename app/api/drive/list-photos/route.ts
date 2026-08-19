export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getPhotosInFolder } from '@/lib/drive';
import { extractGDriveFolderId } from '@/lib/drive-utils';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let rawFolderId = searchParams.get('folderId') || searchParams.get('folderid') || searchParams.get('id');

    // Fallback if searchParams missed it
    if (!rawFolderId && request.url.includes('?')) {
      const queryStr = request.url.split('?')[1] || '';
      const parsed = new URLSearchParams(queryStr);
      rawFolderId = parsed.get('folderId') || parsed.get('folderid') || parsed.get('id');
    }

    const cleanFolderId = extractGDriveFolderId(rawFolderId || undefined);

    if (!cleanFolderId) {
      return NextResponse.json(
        { error: 'Folder Google Drive belum dikonfigurasi atau ID folder tidak valid.' },
        { status: 400 }
      );
    }

    const photos = await getPhotosInFolder(cleanFolderId);

    // Helper to format thumbnail size reliably across all GDrive URL formats
    const formatThumbUrl = (url: string | null | undefined, sizeStr: string) => {
      if (!url) return null;
      return url
        .replace(/=s\d+(-c)?$/, `=${sizeStr}`)
        .replace(/=w\d+-h\d+(-c)?$/, `=${sizeStr}`)
        .replace(/=s\d+/, `=${sizeStr}`);
    };

    // Map to a cleaner format for the frontend
    const formattedPhotos = photos.map((photo) => {
      const baseThumb = photo.thumbnailLink || null;

      // Gallery thumbnail: s300 — sangat cepat & ringan untuk grid mobile (~20-30KB per foto)
      let thumbUrl = formatThumbUrl(baseThumb, 's300') || `/api/drive/image?id=${photo.id}&sz=s300`;

      // Preview (fullscreen tap): s1000 — resolusi cukup tinggi, tajam & cepat (~150KB)
      let previewUrl = formatThumbUrl(baseThumb, 's1000') || `/api/drive/image?id=${photo.id}&sz=s1000`;

      return {
        id: photo.id,
        name: photo.name,
        thumbnailUrl: thumbUrl,
        previewUrl: previewUrl,
        fallbackUrl: `/api/drive/image?id=${photo.id}&sz=s300`,
        fullUrl: `/api/drive/image?id=${photo.id}&sz=full`,
      };
    });

    return NextResponse.json({
      success: true,
      photos: formattedPhotos,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}
