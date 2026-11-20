import { google } from 'googleapis';
import { isUsablePrivateKey, normalizePrivateKey, parseServiceAccountJson } from './pem';

// Define the scopes required (we need full drive access for folders and files)
const SCOPES = ['https://www.googleapis.com/auth/drive'];

export type DriveCredentialStatus = {
  credentials: { client_email: string; private_key: string } | null;
  error?: string; // alasan bila variabel ada tetapi tidak bisa dipakai
  source?: string; // variabel lingkungan yang dipakai
};

/**
 * Kredensial Service Account Google Drive — HANYA dari variabel lingkungan server:
 *  - GOOGLE_SERVICE_ACCOUNT_KEY  = isi JSON service account, atau
 *  - GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY, atau
 *  - (cadangan) FIREBASE_SERVICE_ACCOUNT_KEY — service account Firebase yang sama dapat
 *    dipakai untuk Drive selama Google Drive API aktif di project-nya dan folder
 *    "ZeeyStudio" dibagikan ke email service account tersebut.
 * Private key dinormalisasi (baris baru, \n literal, tanda kutip, CRLF) dan divalidasi.
 */
export function getDriveCredentialStatus(): DriveCredentialStatus {
  let email = "";
  let rawKey = "";
  let source = "";

  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const parsed = parseServiceAccountJson(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    if (parsed) {
      email = parsed.client_email;
      rawKey = parsed.private_key;
      source = "GOOGLE_SERVICE_ACCOUNT_KEY";
    } else if (!process.env.GOOGLE_PRIVATE_KEY) {
      return { credentials: null, error: "GOOGLE_SERVICE_ACCOUNT_KEY bukan isi JSON service account yang valid (client_email / private_key tidak ditemukan)." };
    }
  }
  if (!rawKey && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    email = process.env.GOOGLE_CLIENT_EMAIL.trim();
    rawKey = process.env.GOOGLE_PRIVATE_KEY;
    source = "GOOGLE_PRIVATE_KEY";
  }
  if (!rawKey && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const parsed = parseServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    if (parsed) {
      email = parsed.client_email;
      rawKey = parsed.private_key;
      source = "FIREBASE_SERVICE_ACCOUNT_KEY";
    }
  }
  if (!rawKey) return { credentials: null };

  const privateKey = normalizePrivateKey(rawKey);
  if (!isUsablePrivateKey(privateKey)) {
    return {
      credentials: null,
      error: `Private key di ${source} tidak dapat dibaca (format PEM rusak atau terpotong). ` +
        "Salin ulang seluruh isi berkas JSON service account Google ke GOOGLE_SERVICE_ACCOUNT_KEY.",
    };
  }
  return { credentials: { client_email: email, private_key: privateKey }, source };
}

export function getDriveCredentials(): { client_email: string; private_key: string } | null {
  return getDriveCredentialStatus().credentials;
}

/**
 * Initializes and returns an authenticated Google Drive service instance.
 */
export async function getDriveService() {
  const { credentials, error } = getDriveCredentialStatus();
  if (!credentials) {
    throw new Error(
      error ||
      'Kredensial Google Drive belum diatur. Isi GOOGLE_SERVICE_ACCOUNT_KEY (JSON service account) ' +
      'atau GOOGLE_CLIENT_EMAIL & GOOGLE_PRIVATE_KEY di variabel lingkungan server.'
    );
  }
  try {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES, credentials });
    return google.drive({ version: 'v3', auth });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('DECODER') || msg.includes('unsupported') || msg.includes('routines')) {
      throw new Error(
        'Private key Google Service Account tidak dapat dibaca oleh OpenSSL (error:1E08010C:DECODER routines::unsupported). ' +
        'Kemungkinan isi GOOGLE_SERVICE_ACCOUNT_KEY terpotong atau format PEM-nya rusak saat disalin ke variabel lingkungan. ' +
        'Salin ulang seluruh isi berkas JSON service account ke GOOGLE_SERVICE_ACCOUNT_KEY.'
      );
    }
    throw err;
  }
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
          fields: 'nextPageToken, files(id, name, size, thumbnailLink, webContentLink)',
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
