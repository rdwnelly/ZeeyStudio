/**
 * Utility function to ensure any GDrive URL or Folder ID is converted to a valid, full https:// URL.
 * Prevents 404 errors caused by relative URL resolution in browser window.open().
 */
export function formatGDriveUrl(linkOrId?: string): string {
  if (!linkOrId) return "https://drive.google.com";
  let trimmed = linkOrId.trim();
  if (!trimmed) return "https://drive.google.com";

  // Check if it already starts with http:// or https://
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Check if it starts with drive.google.com or www.drive.google.com
  if (/^drive\.google\.com/i.test(trimmed) || /^www\.drive\.google\.com/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Check if it matches a Google Drive folder ID pattern (e.g. 1AbCdEF...)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return `https://drive.google.com/drive/folders/${trimmed}`;
  }

  // Fallback: prepend https://
  return `https://${trimmed}`;
}
