// Western numerals even in the Arabic/Hebrew UI — the club reads 3,500, not
// ٣٬٥٠٠ (owner ruling). Pinned to "en-US" so the digits are ALWAYS Western
// regardless of the active locale; pair the output with a `.num` span for LTR
// bidi-isolation in RTL. Extracted from money-screen so this load-bearing rule
// is unit-tested and can't silently regress to locale-aware digits.
export const fmtNumber = (n: number): string => n.toLocaleString("en-US");
