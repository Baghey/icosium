/** Âge minimum pour utiliser ICOSIUM (décision du 5 novembre 2026). */
export const MIN_AGE = 16;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Lit une date de naissance au format AAAA-MM-JJ.
 * Renvoie null si le texte n'est pas une vraie date du calendrier.
 */
export function parseBirthdate(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** Âge en années révolues à la date `now` (UTC). Null si la date est invalide ou future. */
export function ageOn(birthdate: string, now: Date): number | null {
  const b = parseBirthdate(birthdate);
  if (!b) return null;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  let age = y - b.year;
  if (m < b.month || (m === b.month && d < b.day)) age -= 1;
  if (age < 0) return null;
  return age;
}

export type BirthdateCheck = { ok: true; age: number } | { ok: false; reason: "invalid" | "too_young" | "implausible" };

/** Vérifie qu'une date de naissance autorise l'inscription. */
export function checkBirthdate(birthdate: string, now: Date = new Date()): BirthdateCheck {
  const age = ageOn(birthdate, now);
  if (age === null) return { ok: false, reason: "invalid" };
  if (age > 120) return { ok: false, reason: "implausible" };
  if (age < MIN_AGE) return { ok: false, reason: "too_young" };
  return { ok: true, age };
}
