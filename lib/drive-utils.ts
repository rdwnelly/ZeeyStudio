/**
 * Extract clean Google Drive Folder ID from a URL, folder link, or raw ID string.
 * Returns null if missing or invalid.
 */
export function extractGDriveFolderId(linkOrId?: string): string | null {
  if (!linkOrId) return null;
  const trimmed = linkOrId.trim();
  if (!trimmed || trimmed.includes("@")) return null;

  // 1. Match folders/ID pattern (supports /drive/folders/ID, /drive/u/0/folders/ID, /drive/mobile/folders/ID, etc.)
  const foldersMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch && foldersMatch[1]) {
    return foldersMatch[1];
  }

  // 2. Match id=ID pattern (open?id=ID, folderview?id=ID)
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) || trimmed.match(/^id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  // 3. Match file/d/ID pattern (fallback if a file link was pasted)
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return fileMatch[1];
  }

  // 4. Raw Google Drive folder ID (15+ chars of base64url characters)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Utility function to ensure any GDrive URL or Folder ID is converted to a valid, full https:// URL.
 * Returns empty string "" if linkOrId is missing, invalid, or an email address, so callers can trigger auto-creation.
 */
export function formatGDriveUrl(linkOrId?: string): string {
  if (!linkOrId) return "";
  let trimmed = linkOrId.trim();
  if (!trimmed || trimmed.includes("@")) return "";

  const folderId = extractGDriveFolderId(trimmed);
  if (folderId) {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }

  // If it's already a full http/https URL to google drive
  if (/^https?:\/\/.*drive\.google\.com/i.test(trimmed)) {
    return trimmed;
  }

  // If it starts with drive.google.com or www.drive.google.com
  if (/^drive\.google\.com/i.test(trimmed) || /^www\.drive\.google\.com/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return "";
}

