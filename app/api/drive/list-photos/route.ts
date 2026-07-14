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

    const photos = await getPhotosInFolder(folderId);

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
