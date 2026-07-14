import { NextResponse } from 'next/server';
import { createFolder, getFolderIdByName } from '@/lib/drive';

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

    // Create the new folder inside the main folder (if found), otherwise at root
    const folderId = await createFolder(folderName, parentFolderId || undefined);

    return NextResponse.json({
      success: true,
      message: `Folder ${folderName} created successfully`,
      folderId,
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create folder' },
      { status: 500 }
    );
  }
}
