import { NextResponse } from 'next/server';
import { createFolder, createShortcut, makeFolderPublic } from '@/lib/drive';

// We use nodejs runtime because googleapis relies on Node.js core modules
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max duration to allow for many photo copies

export async function POST(request: Request) {
  try {
    const { projectId, clientName, photoIds, sourceFolderId } = await request.json();

    if (!projectId || !clientName || !photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json({ error: 'Data tidak lengkap atau tidak ada foto yang dipilih.' }, { status: 400 });
    }

    console.log(`Starting export for project ${projectId} (${clientName}), ${photoIds.length} photos`);

    // 1. Create a new folder
    const folderName = `[Pilihan] ZeeyStudio - ${clientName}`;
    
    // Create it alongside the source folder (or in root if sourceFolderId is not provided)
    // To create it alongside, we would need the parent ID of the source folder.
    // For simplicity, we'll create it in the root folder of the Service Account (which is what we get when parentId is omitted).
    const newFolderId = await createFolder(folderName);
    
    if (!newFolderId) {
      throw new Error('Gagal membuat folder Google Drive.');
    }

    console.log(`Created new folder ${folderName} with ID ${newFolderId}`);

    // 2. Make the folder public so the client can access it
    await makeFolderPublic(newFolderId);

    // 3. Copy files (as shortcuts) to the new folder in batches to avoid timing out when handling >100 photos
    const results: Array<{ id: string; status: 'success' | 'error' }> = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < photoIds.length; i += BATCH_SIZE) {
      const batch = photoIds.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (fileId: string, batchIndex: number) => {
        const globalIndex = i + batchIndex;
        try {
          const newFileName = `foto_${globalIndex + 1}.jpg`;
          await createShortcut(fileId, newFolderId, newFileName);
          return { id: fileId, status: 'success' as const };
        } catch (err) {
          console.error(`Failed to create shortcut for file ${fileId}:`, err);
          return { id: fileId, status: 'error' as const };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (i + BATCH_SIZE < photoIds.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const folderUrl = `https://drive.google.com/drive/folders/${newFolderId}`;

    return NextResponse.json({
      success: true,
      folderId: newFolderId,
      folderUrl: folderUrl,
      results: results
    });

  } catch (error: any) {
    console.error('Export Folder API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal mengekspor folder ke Google Drive' },
      { status: 500 }
    );
  }
}
