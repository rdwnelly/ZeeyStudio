import { NextResponse } from 'next/server';
import { createFolder, getFolderIdByName, makeFolderPublic } from '@/lib/drive';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientName } = body;

    if (!clientName) {
      return NextResponse.json(
        { error: 'clientName is required' },
        { status: 400 }
      );
    }

    // Format the folder name: e.g. "Jul-2026-[ClientName]"
    const date = new Date();
    const month = date.toLocaleString('id-ID', { month: 'short' });
    const year = date.getFullYear();
    const folderName = `${month}-${year}-${clientName.replace(/\s+/g, '-')}`;

    // Find the main "ZeeyStudio" folder to use as the parent
    const parentFolderId = await getFolderIdByName("ZeeyStudio");

    if (!parentFolderId) {
      return NextResponse.json(
        { error: 'Folder induk "ZeeyStudio" tidak ditemukan. Pastikan Anda sudah membuat folder bernama "ZeeyStudio" di Google Drive pribadi Anda dan membagikannya (Share) dengan akses Editor ke email Service Account.' },
        { status: 404 }
      );
    }

    // Create the new folder inside the main folder
    const folderId = await createFolder(folderName, parentFolderId);
    if (folderId) {
      await makeFolderPublic(folderId);

      // Create structured subfolders automatically
      try {
        const rawFolderId = await createFolder("01_Foto_Mentah", folderId);
        if (rawFolderId) await makeFolderPublic(rawFolderId);

        const editFolderId = await createFolder("02_Hasil_Edit", folderId);
        if (editFolderId) await makeFolderPublic(editFolderId);
      } catch (subErr) {
        console.warn("Subfolder creation notice:", subErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Folder ${folderName} created successfully with subfolders`,
      folderId,
      folderName,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create folder' },
      { status: 500 }
    );
  }
}
