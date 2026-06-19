// Normalize an Israeli mobile number to E.164 (+972XXXXXXXXX) for Supabase OTP.
// Accepts the shapes a coach actually types: 052-348-1100, 0523481100,
// +972523481100, 972523481100, or a bare 523481100. Returns null when the
// input can't be a valid IL mobile so the caller can show a warm error.
export function normalizeIsraeliPhone(raw: string): string | null {
  // Keep a leading +, drop every other non-digit (spaces, dashes, parens).
  const cleaned = raw.trim().replace(/(?!^\+)\D/g, "");
  const digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

  let national: string;
  if (digits.startsWith("972")) {
    national = digits.slice(3); // +972 / 972 prefix
  } else if (digits.startsWith("0")) {
    national = digits.slice(1); // local 0XX… form
  } else {
    national = digits; // bare national number
  }

  // IL mobile national numbers are 9 digits and start with 5 (05X locally).
  if (national.length !== 9 || !national.startsWith("5")) return null;

  return `+972${national}`;
}
