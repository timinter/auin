/**
 * Input sanitization utilities.
 * Strips dangerous characters and enforces safe patterns for financial data.
 */

/** Strip HTML tags, null bytes, and control characters from a string */
export function sanitizeText(input: string): string {
  return input
    .replace(/\0/g, "")                    // null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars (keep \n, \r, \t)
    .replace(/<[^>]*>/g, "")               // HTML tags
    .replace(/javascript:/gi, "")          // JS protocol
    .replace(/on\w+\s*=/gi, "")            // event handlers
    .trim();
}

/** Alphanumeric + basic punctuation only (names, notes) */
export function sanitizeName(input: string): string {
  return sanitizeText(input).replace(/[^a-zA-ZÀ-ÿА-яЁё0-9\s\-'.,()/&]/g, "").trim();
}

/** SWIFT/BIC code: 8 or 11 uppercase alphanumeric chars */
export function isValidSwift(value: string): boolean {
  return /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(value);
}

/** IBAN: 2 letter country code + 2 check digits + up to 30 alphanumeric */
export function isValidIban(value: string): boolean {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(value.replace(/\s/g, "").toUpperCase());
}

/** Account number: digits, dashes, spaces only */
export function isValidAccountNumber(value: string): boolean {
  return /^[\d\s\-]{4,34}$/.test(value);
}

/** Routing number: exactly 9 digits (US ABA) */
export function isValidRoutingNumber(value: string): boolean {
  return /^\d{9}$/.test(value);
}

/** Safe money value: positive, max 2 decimal places, reasonable bounds */
export function isValidMoneyAmount(value: number, max: number = 1_000_000): boolean {
  return value >= 0 && value <= max && Number.isFinite(value);
}

/** Normalize IBAN: strip spaces, uppercase */
export function normalizeIban(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

/** Normalize SWIFT: uppercase, strip spaces */
export function normalizeSwift(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}
