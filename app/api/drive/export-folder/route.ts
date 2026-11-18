import { NextResponse } from 'next/server';
import { createFolder, createShortcut, makeFolderPublic, getFolderIdByName } from '@/lib/drive';
import { filterDownloadable } from '@/lib/photo-access';
import { loadProject } from '@/lib/client-project';
import { extractGDriveFolderId } from '@/lib/drive-utils';

// We use nodejs runtime because googleapis relies on Node.js core modules
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max duration to allow for many photo copies

export async function POST(request: Request) {
  try {
    const { projectId, clientName, photoIds } = await request.json();
    // Folder sumber di-resolve di server dari data proyek (tidak dipercaya dari browser)
    const sourceProject = await loadProject(String(projectId || ''));
    const sourceFolderId =
      extractGDriveFolderId(sourceProject?.gdriveFolderId) ||
      extractGDriveFolderId(sourceProject?.gdriveLinkHighRes) ||
      extractGDriveFolderId(sourceProject?.gdriveLinkWatermark);

    if (!projectId || !clientName || !photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json({ error: 'Data tidak lengkap atau tidak ada foto yang dipilih.' }, { status: 400 });
    }

    // Hanya foto pilihan pada proyek yang sudah dibayar yang boleh diekspor
    const { allowed } = await filterDownloadable(projectId, photoIds);
    if (allowed.length === 0) {
      return NextResponse.json({ error: 'Foto belum dapat diekspor: pembayaran belum selesai atau foto tidak termasuk pilihan.' }, { status: 403 });
    }

    console.log(`Starting export for project ${projectId} (${clientName}), ${photoIds.length} photos`);

    // 1. Create a new folder
    const folderName = `[Pilihan] ZeeyStudio - ${clientName}`;
    
    // Create it alongside the source folder (or in root if sourceFolderId is not provided)
    // To create it alongside, we would need the parent ID of the source folder.
    // For simplicity, we'll create it in the root folder of the Service Account (which is what we get when parentId is omitted).
    // Simpan di dalam folder induk "ZeeyStudio" agar mudah dikelola studio;
    // bila tidak ditemukan, gunakan root milik Service Account (perilaku lama).
    let parentId: string | undefined;
    try {
      parentId = (await getFolderIdByName('ZeeyStudio')) || undefined;
    } catch {
      parentId = undefined;
    }
    const newFolderId = await createFolder(folderName, parentId);
    
    if (!newFolderId) {
      throw new Error('Gagal membuat folder Google Drive.');
    }

    console.log(`Created new folder ${folderName} with ID ${newFolderId}`);

    // 2. Make the new folder and source folder public so the client can access them
    await makeFolderPublic(newFolderId);
    if (sourceFolderId) {
      await makeFolderPublic(sourceFolderId);
    }

    // 3. Copy files (as shortcuts) to the new folder in batches and grant public permissions to target photo files
    const results: Array<{ id: string; status: 'success' | 'error' }> = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < allowed.length; i += BATCH_SIZE) {
      const batch = allowed.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (fileId: string, batchIndex: number) => {
        const globalIndex = i + batchIndex;
        try {
          const newFileName = `foto_${globalIndex + 1}.jpg`;
          const shortcut = await createShortcut(fileId, newFolderId, newFileName);
          // Make target photo file public so shortcut target can be opened by client without permission prompt
          await makeFolderPublic(fileId);
          if (shortcut && shortcut.id) {
            await makeFolderPublic(shortcut.id);
          }
          return { id: fileId, status: 'success' as const };
        } catch (err) {
          console.error(`Failed to create shortcut/permissions for file ${fileId}:`, err);
          return { id: fileId, status: 'error' as const };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (i + BATCH_SIZE < allowed.length) {
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
