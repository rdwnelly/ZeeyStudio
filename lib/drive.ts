import { google } from 'googleapis';
import path from 'path';

// Path to the service account credentials file
const KEY_FILE_PATH = path.join(process.cwd(), 'lib', 'zeeystudio-502410-03512456b81a.json');

// Define the scopes required (we need full drive access for folders and files)
const SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Initializes and returns an authenticated Google Drive service instance.
 */
export async function getDriveService() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: SCOPES,
  });

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
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
      fields: 'files(id, name, thumbnailLink, webContentLink)',
      spaces: 'drive',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    
    return res.data.files || [];
  } catch (err) {
    console.error(`Error fetching photos in folder ${folderId}:`, err);
    throw err;
  }
}
