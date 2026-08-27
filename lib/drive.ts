import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

// Path to the service account credentials file (used in local dev if present)
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

  // Option 1: Local JSON credentials file (highest priority in development if file exists)
  if (fs.existsSync(KEY_FILE_PATH)) {
    try {
      const fileContent = fs.readFileSync(KEY_FILE_PATH, 'utf8');
      const parsed = JSON.parse(fileContent);
      authOptions.credentials = {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      };
    } catch (e) {
      authOptions.keyFile = KEY_FILE_PATH;
    }
  }

  // Option 2: Read from Firestore settings/gdrive (if configured in Dashboard)
  if (!authOptions.credentials) {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const gdriveSnap = await getDoc(doc(db, 'settings', 'gdrive'));
      if (gdriveSnap.exists()) {
        const gData = gdriveSnap.data();
        if (gData.service_account_json) {
          try {
            const parsed = JSON.parse(gData.service_account_json);
            authOptions.credentials = {
              client_email: parsed.client_email,
              private_key: parsed.private_key ? parsed.private_key.replace(/\\n/g, '\n') : undefined,
            };
          } catch (e) {
            console.warn('[drive] Failed to parse Firestore service_account_json:', e);
          }
        } else if (gData.client_email && gData.private_key) {
          let rawKey = gData.private_key.trim();
          if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
            rawKey = rawKey.slice(1, -1);
          }
          authOptions.credentials = {
            client_email: gData.client_email,
            private_key: rawKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n'),
          };
        }
      }
    } catch (e) {
      console.warn('[drive] Firestore settings/gdrive fallback check notice:', e);
    }
  }

  // Option 3: Full JSON string in GOOGLE_SERVICE_ACCOUNT_KEY
  if (!authOptions.credentials && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsedKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      authOptions.credentials = {
        client_email: parsedKey.client_email,
        private_key: parsedKey.private_key ? parsedKey.private_key.replace(/\\n/g, '\n') : undefined,
      };
    } catch (e) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY environment variable:', e);
    }
  }

  // Option 4: Individual GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY environment variables
  if (!authOptions.credentials && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    let rawKey = process.env.GOOGLE_PRIVATE_KEY.trim();
    if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
      rawKey = rawKey.slice(1, -1);
    }
    const cleanKey = rawKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
    authOptions.credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: cleanKey,
    };
  }

  if (!authOptions.credentials && !authOptions.keyFile) {
    throw new Error(
      'Google Drive service account credentials missing. Please set GOOGLE_CLIENT_EMAIL & GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_KEY in environment variables, or configure in Dashboard Settings.'
    );
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
    let folderIdsToSearch = [folderId];

    // 1. Get subfolder IDs inside parent folder (e.g., 01_Foto_Mentah, 02_Hasil_Edit)
    try {
      const subFoldersRes: any = await drive.files.list({
        q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      if (subFoldersRes.data.files && subFoldersRes.data.files.length > 0) {
        subFoldersRes.data.files.forEach((f: any) => {
          if (f.id) folderIdsToSearch.push(f.id);
        });
      }
    } catch (e) {
      console.warn("Notice listing subfolders:", e);
    }

    // 2. Fetch image files from parent folder + subfolders
    for (const targetId of folderIdsToSearch) {
      let pageToken: string | undefined = undefined;
      do {
        const res: any = await drive.files.list({
          q: `'${targetId}' in parents and mimeType contains 'image/' and trashed=false`,
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
    }

    // De-duplicate files by id
    const uniqueFilesMap = new Map();
    allFiles.forEach(f => uniqueFilesMap.set(f.id, f));

    return Array.from(uniqueFilesMap.values());
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
