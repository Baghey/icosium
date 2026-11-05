/**
 * Limiteur simple en mémoire : au plus `limit` actions par `windowMs` pour une même clé.
 * Suffisant pour un seul serveur ; à remplacer par Redis quand il y aura plusieurs serveurs.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now: number = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}
