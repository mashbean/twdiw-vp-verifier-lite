// Age verification — "are you an adult?" without the verifier learning more than
// it needs. The driving-licence card can disclose only its `roc_birthday` field
// (a Taiwan 民國 date) and nothing else — not name, not ID number, not address —
// and the verifier turns that one field into a single yes/no answer.
//
// Honest about the limit: the birthday itself is still revealed. A proof that
// hides even the birthday needs the zero-knowledge layer (a range proof that
// birth ≤ today − 18y); this is the minimal-disclosure step before that.

/** Find a claim value by name anywhere in a (possibly nested) claims object.
 *  TWDIW nests disclosed claims under `vc.credentialSubject`, so a flat lookup
 *  would miss `roc_birthday`. */
export function findClaim(node: unknown, name: string): unknown {
  if (node && typeof node === "object") {
    if (!Array.isArray(node)) {
      const obj = node as Record<string, unknown>;
      if (name in obj && typeof obj[name] !== "object") return obj[name];
    }
    for (const v of Object.values(node as Record<string, unknown>)) {
      const found = findClaim(v, name);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export interface GregorianDate {
  year: number;
  month: number;
  day: number;
}

/** Parse a Taiwan ROC date string (e.g. "0570605" = 民國57-06-05 → 1968-06-05).
 *  The ROC year may be 2 or 3 digits; the last four digits are always MMDD. */
export function parseRocDate(s: unknown): GregorianDate | null {
  const digits = String(s ?? "").replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 7) return null;
  const rocYear = parseInt(digits.slice(0, digits.length - 4), 10);
  const month = parseInt(digits.slice(digits.length - 4, digits.length - 2), 10);
  const day = parseInt(digits.slice(digits.length - 2), 10);
  if (!rocYear || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year: rocYear + 1911, month, day };
}

/** Whether someone born on `birth` is at least `min` years old at `nowMs`. */
export function isAtLeastAge(birth: GregorianDate, min: number, nowMs: number): boolean {
  const now = new Date(nowMs);
  let age = now.getUTCFullYear() - birth.year;
  const monthsAhead = now.getUTCMonth() + 1 - birth.month;
  if (monthsAhead < 0 || (monthsAhead === 0 && now.getUTCDate() < birth.day)) age -= 1;
  return age >= min;
}

/** The whole check: pull `roc_birthday` from the disclosed claims and answer
 *  "at least `min`?". Returns null when no usable birthday was disclosed. */
export function isAdultFromClaims(claims: unknown, min: number, nowMs: number): boolean | null {
  const birth = parseRocDate(findClaim(claims, "roc_birthday"));
  if (!birth) return null;
  return isAtLeastAge(birth, min, nowMs);
}
