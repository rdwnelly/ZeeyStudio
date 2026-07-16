import { NextResponse } from 'next/server';
import { getPhotosInFolder } from '@/lib/drive';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json(
        { error: 'folderId parameter is required' },
        { status: 400 }
      );
    }

    // Extract ID if a full link was passed
    let cleanFolderId = folderId;
    if (folderId.includes('drive.google.com/drive/folders/')) {
      const parts = folderId.split('folders/');
      if (parts.length > 1) {
        cleanFolderId = parts[1].split('?')[0].split('/')[0];
      }
    } else if (folderId.includes('drive.google.com/file/d/')) {
      const parts = folderId.split('file/d/');
      if (parts.length > 1) {
        cleanFolderId = parts[1].split('/')[0];
      }
    }

    const photos = await getPhotosInFolder(cleanFolderId);

    // Map to a cleaner format for the frontend
    const formattedPhotos = photos.map((photo) => ({
      id: photo.id,
      name: photo.name,
      thumbnailUrl: `/api/drive/image?id=${photo.id}`,
      fullUrl: `/api/drive/image?id=${photo.id}`,
    }));

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
