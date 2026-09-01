/**
 * Date utility functions for handling both ISO and Persian date formats
 */

/**
 * Checks if a date string is in ISO format
 */
export const isISODate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(dateStr);
};

/**
 * Checks if a date string is in Persian format
 */
export const isPersianDate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  // Persian format: 1403/11/06 or 1403-11-06
  return /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(dateStr);
};

/**
 * Converts ISO date string to Persian date format
 */
export const convertISOToPersian = (isoDate: string): string => {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) {
      console.warn('Invalid ISO date:', isoDate);
      return isoDate; // Return original if invalid
    }
    return date.toLocaleDateString('fa-IR-u-nu-latn');
  } catch (error) {
    console.error('Error converting ISO to Persian:', error);
    return isoDate; // Return original on error
  }
};

/**
 * Normalizes a date string to Persian format
 * Handles both ISO and Persian formats
 */
export const normalizeDateToPersian = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  
  // If already in Persian format, return as-is
  if (isPersianDate(dateStr)) {
    return dateStr;
  }
  
  // If in ISO format, convert to Persian
  if (isISODate(dateStr)) {
    return convertISOToPersian(dateStr);
  }
  
  // Unknown format, return as-is
  console.warn('Unknown date format:', dateStr);
  return dateStr;
};

/**
 * Gets current date in Persian format
 */
export const getCurrentPersianDate = (): string => {
  return new Date().toLocaleDateString('fa-IR-u-nu-latn');
};

/**
 * Gets current time in Persian format
 */
export const getCurrentPersianTime = (): string => {
  return new Date().toLocaleTimeString('fa-IR-u-nu-latn', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Normalizes a Persian date string for safe string comparison:
 * - Converts Persian/Arabic digits to Latin
 * - Zero-pads month and day to 2 digits
 *
 * Examples:
 *   "1403/2/5"     -> "1403/02/05"
 *   "۱۴۰۳/۲/۵"     -> "1403/02/05"
 *   "1403/02/05"   -> "1403/02/05"
 *
 * Use this on BOTH sides of any date >= / <= comparison, because DB dates
 * come from toLocaleDateString('fa-IR-u-nu-latn') (Latin, unpadded) while
 * react-multi-date-picker via persian_fa emits Persian digits + padded.
 */
export const normalizePersianDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';

  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let normalized = '';
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr[i];
    const pIdx = persianDigits.indexOf(char);
    const aIdx = arabicDigits.indexOf(char);
    if (pIdx !== -1) normalized += pIdx;
    else if (aIdx !== -1) normalized += aIdx;
    else normalized += char;
  }

  const parts = normalized.split('/');
  if (parts.length !== 3) return normalized;
  return `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
};
