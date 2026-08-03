import { NextResponse } from 'next/server';
import { getDriveService, makeFolderPublic } from '@/lib/drive';
import { Readable } from 'stream';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folderId = formData.get('folderId') as string;

    if (!file || !folderId) {
      return NextResponse.json(
        { error: 'File and folderId are required' },
        { status: 400 }
      );
    }

    // Convert file to buffer and then to a Readable stream
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const drive = await getDriveService();

    // Set up file metadata
    const fileMetadata = {
      name: file.name,
      parents: [folderId],
    };

    // Set up media
    const media = {
      mimeType: file.type,
      body: stream,
    };

    // Upload to Google Drive
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    if (response.data.id) {
      await makeFolderPublic(response.data.id);
    }

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink,
    });
  } catch (error: any) {
    console.error('API Error (Upload to Drive):', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file to Google Drive' },
      { status: 500 }
    );
  }
}
