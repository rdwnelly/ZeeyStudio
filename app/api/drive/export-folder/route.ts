import { NextResponse } from 'next/server';
import { createFolder, copyFile, makeFolderPublic } from '@/lib/drive';

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

    // 3. Copy files to the new folder sequentially to avoid rate limits
    // Alternatively, we could chunk them, but sequential is safer.
    const results = [];
    for (let i = 0; i < photoIds.length; i++) {
      const fileId = photoIds[i];
      try {
        const newFileName = `foto_${i + 1}.jpg`;
        await copyFile(fileId, newFolderId, newFileName);
        results.push({ id: fileId, status: 'success' });
      } catch (err) {
        console.error(`Failed to copy file ${fileId}:`, err);
        results.push({ id: fileId, status: 'error' });
      }
      
      // Add a small delay between copies to avoid Google Drive API rate limits (1000 requests per 100 seconds)
      // We'll sleep for 200ms
      await new Promise(resolve => setTimeout(resolve, 200));
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
