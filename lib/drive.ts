import { google } from 'googleapis';
import path from 'path';

// Path to the service account credentials file
const KEY_FILE_PATH = path.join(process.cwd(), 'lib', 'zeeystudio-503010-46fd8f8fb56b.json');

// Define the scopes required (we need full drive access for folders and files)
const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Initializes and returns an authenticated Google Drive service instance.
 */
export async function getDriveService() {
  let authOptions: any = {
    scopes: SCOPES,
  };

  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    authOptions.credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      // Replace literal '\n' with actual line breaks for the private key
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  } else {
    authOptions.keyFile = KEY_FILE_PATH;
  }

  const auth = new google.auth.GoogleAuth(authOptions);

  return google.drive({ version: 'v3', auth });
}

/**
 * Helper to create a folder in Google Drive.
 * @param folderName The name of the new folder
 * @param parentId Optional ID of the parent folder
 * @returns The created folder's ID
 */
export async function createFolder(folderName: string, parentId?: string): Promise<string | null | undefined> {
  const drive = await getDriveService();

  const fileMetadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  try {
    const file = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });
    return file.data.id;
  } catch (err) {
    console.error('Error creating folder in Google Drive:', err);
    throw err;
  }
}

/**
 * Helper to get a folder ID by its name.
 * Useful for finding the root "ZeeyStudio" folder shared with the service account.
 */
export async function getFolderIdByName(folderName: string): Promise<string | null> {
  const drive = await getDriveService();
  try {
    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = res.data.files;
    if (files && files.length > 0) {
      return files[0].id || null;
    }
    return null;
  } catch (err) {
    console.error(`Error finding folder ${folderName}:`, err);
    throw err;
  }
}

/**
 * Helper to fetch all image files from a specific folder.
 * Requests webContentLink (for direct download/viewing full image if public) 
 * and thumbnailLink (for gallery previews).
 */
export async function getPhotosInFolder(folderId: string) {
  const drive = await getDriveService();
  try {
    let allFiles: any[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const res: any = await drive.files.list({
        q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
        fields: 'nextPageToken, files(id, name, thumbnailLink, webContentLink)',
        spaces: 'drive',
        pageSize: 1000,
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      if (res.data.files && res.data.files.length > 0) {
        allFiles.push(...res.data.files);
      }

      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return allFiles;
  } catch (err) {
    console.error(`Error fetching photos in folder ${folderId}:`, err);
    throw err;
  }
}

/**
 * Helper to create a shortcut to a file in Google Drive.
 * We use shortcuts instead of copies because Service Accounts have 0 bytes storage quota.
 */
export async function createShortcut(fileId: string, destFolderId: string, newName?: string) {
  const drive = await getDriveService();
  try {
    const requestBody: any = {
      mimeType: 'application/vnd.google-apps.shortcut',
      shortcutDetails: { targetId: fileId },
      parents: [destFolderId],
    };
    if (newName) {
      requestBody.name = newName;
    }

    const res = await drive.files.create({
      requestBody: requestBody,
      fields: 'id, name',
      supportsAllDrives: true,
    });
    
    return res.data;
  } catch (err) {
    console.error(`Error creating shortcut for file ${fileId}:`, err);
    throw err;
  }
}

/**
 * Helper to make a folder (or file) public "Anyone with the link can view".
 */
export async function makeFolderPublic(folderId: string) {
  const drive = await getDriveService();
  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });
  } catch (err: any) {
    console.warn(`Notice making item ${folderId} public:`, err?.message || err);
  }
}
