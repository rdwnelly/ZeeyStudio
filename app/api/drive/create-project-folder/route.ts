import { NextResponse } from 'next/server';
import { createFolder, getFolderIdByName, makeFolderPublic } from '@/lib/drive';
import { verifyStaff } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    if (!(await verifyStaff(request))) {
      return NextResponse.json({ error: 'Hanya staf yang login yang dapat melakukan ini.' }, { status: 401 });
    }
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
    const msg = error?.message || String(error);
    // Tangkap error OpenSSL private key dan berikan pesan yang jelas
    if (msg.includes('DECODER') || msg.includes('unsupported') || msg.includes('1E08010C')) {
      return NextResponse.json(
        {
          error: 'Private key Google Service Account tidak dapat dibaca (error OpenSSL). ' +
            'Pastikan seluruh isi JSON service account disalin dengan benar ke variabel lingkungan GOOGLE_SERVICE_ACCOUNT_KEY di hosting Anda. ' +
            'Tips: salin isi file JSON apa adanya (satu baris utuh), jangan potong atau ubah format.'
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: msg || 'Failed to create folder' },
      { status: 500 }
    );
  }
}
