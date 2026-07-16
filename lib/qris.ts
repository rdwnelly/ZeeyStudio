/**
 * Calculates the CRC-CCITT (0xFFFF) of a string.
 */
export function crc16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  const hex = (crc & 0xFFFF).toString(16).toUpperCase();
  return hex.padStart(4, '0');
}

/**
 * Converts a static QRIS string into a dynamic QRIS string with a specific amount.
 */
export function generateDynamicQris(staticQris: string, amount: number, orderId?: string): string {
  // Ensure the string ends with 6304 and 4 chars CRC
  if (!staticQris || staticQris.length < 8) return staticQris;
  
  // 1. Remove the old CRC (last 4 chars) and the tag 63 length (6304)
  const tag63Index = staticQris.lastIndexOf("6304");
  if (tag63Index === -1) return staticQris;
  
  const base = staticQris.substring(0, tag63Index);
  
  // 2. Change 010211 to 010212 (Point of Initiation Method: 11 is static, 12 is dynamic)
  let dynamicBase = base.replace("010211", "010212");
  
  // 3. Create Tag 54 (Transaction Amount)
  const amountStr = amount.toString();
  const amountLen = amountStr.length.toString().padStart(2, '0');
  const tag54 = `54${amountLen}${amountStr}`;
  
  // 4. Create Tag 62 (Additional Data Field Template) for Order ID
  let tag62 = "";
  if (orderId) {
    // tag 62 subtag 01 is Bill Number
    const billNumLen = orderId.length.toString().padStart(2, '0');
    const subTag01 = `01${billNumLen}${orderId}`;
    const tag62Len = subTag01.length.toString().padStart(2, '0');
    tag62 = `62${tag62Len}${subTag01}`;
  }
  
  // Try to insert Tags before Tag 58 (Country Code)
  const tag58Index = dynamicBase.indexOf("5802ID");
  if (tag58Index !== -1) {
    dynamicBase = dynamicBase.substring(0, tag58Index) + tag54 + tag62 + dynamicBase.substring(tag58Index);
  } else {
    // Fallback: just append it
    dynamicBase += tag54 + tag62;
  }
  
  // 5. Re-append tag 6304
  dynamicBase += "6304";
  
  // 6. Calculate new CRC
  const crc = crc16(dynamicBase);
  
  return dynamicBase + crc;
}
