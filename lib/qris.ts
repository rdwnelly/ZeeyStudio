/**
 * Calculates the CRC-CCITT (0xFFFF) of a string.
 */
export function crc16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  const hex = (crc & 0xFFFF).toString(16).toUpperCase();
  return hex.padStart(4, '0');
}

/**
 * Parses a QRIS string into a Map of tags
 */
function parseQris(qris: string): Map<string, string> {
  const tags = new Map<string, string>();
  let i = 0;
  while (i < qris.length) {
    if (i + 4 > qris.length) break;
    const tag = qris.substring(i, i + 2);
    const lenStr = qris.substring(i + 2, i + 4);
    const len = parseInt(lenStr, 10);
    if (isNaN(len)) break;
    
    if (i + 4 + len > qris.length) break;
    const val = qris.substring(i + 4, i + 4 + len);
    
    if (tag === '63') break; // Ignore CRC, we will recalculate it
    
    tags.set(tag, val);
    i += 4 + len;
  }
  return tags;
}

/**
 * Converts a static QRIS string into a dynamic QRIS string with a specific amount.
 */
export function generateDynamicQris(staticQris: string, amount: number, orderId?: string): string {
  if (!staticQris || staticQris.length < 8) return staticQris;

  const tags = parseQris(staticQris);
  
  // 1. Point of Initiation Method: 11 is static, 12 is dynamic
  if (tags.has("01")) {
    tags.set("01", "12");
  }
  
  // 2. Transaction Amount
  tags.set("54", amount.toString());
  
  // 3. Reconstruct QRIS strictly ordered by EMVCo tags
  let dynamicBase = "";
  const sortedKeys = Array.from(tags.keys()).sort();
  for (const tag of sortedKeys) {
    const val = tags.get(tag)!;
    const len = val.length.toString().padStart(2, '0');
    dynamicBase += `${tag}${len}${val}`;
  }
  
  // 4. Add tag 6304 (CRC)
  dynamicBase += "6304";
  const crc = crc16(dynamicBase);
  
  return dynamicBase + crc;
}
