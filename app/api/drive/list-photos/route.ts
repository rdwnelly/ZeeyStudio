export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getPhotosInFolder } from '@/lib/drive';
import { extractGDriveFolderId } from '@/lib/drive-utils';
import { loadProject } from '@/lib/client-project';
import { verifyStaff } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId') || '';
    let cleanFolderId: string | null = null;

    if (projectId) {
      // Galeri klien: folder di-resolve di server, ID/tautan Drive tidak pernah dikirim ke browser
      const project = await loadProject(projectId);
      cleanFolderId =
        extractGDriveFolderId(project?.gdriveFolderId) ||
        extractGDriveFolderId(project?.gdriveLinkHighRes) ||
        extractGDriveFolderId(project?.gdriveLinkWatermark);
    } else {
      // Mode folderId langsung hanya untuk staf yang login
      if (!(await verifyStaff(request))) {
        return NextResponse.json({ error: 'Gunakan parameter projectId.' }, { status: 401 });
      }
      cleanFolderId = extractGDriveFolderId(searchParams.get('folderId') || undefined);
    }

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
        // Pratinjau besar (bukan berkas asli); berkas asli hanya lewat /api/drive/download setelah bayar
        fullUrl: `/api/drive/image?id=${photo.id}&sz=s1000`,
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
