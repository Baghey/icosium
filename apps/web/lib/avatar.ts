/** Avatars par défaut (images du propriétaire), en attendant la photo de chacun. */
export const DEFAULT_AVATARS = [1, 2, 3, 5, 7, 8];

export function avatarIndex(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % DEFAULT_AVATARS.length;
}

/** L'avatar d'une personne : toujours le même, partout dans l'app. */
export function avatarOf(id: string): string {
  return `/assets/avatars/${DEFAULT_AVATARS[avatarIndex(id)]}.webp`;
}
