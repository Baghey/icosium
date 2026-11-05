/** Icônes du café (SVG maison), nettes à toutes les tailles. */
type P = { className?: string };

/** L'emblème d'ICOSIUM : le nœud doré à huit branches. */
export function Emblem({ className }: P) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/assets/emblem.webp" alt="" aria-hidden="true" className={className} />;
}

export function HourglassIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
    </svg>
  );
}

export function TrophyIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M7 3h10v2h3v2a5 5 0 0 1-4.3 4.95A5 5 0 0 1 13 14.9V17h3v3H8v-3h3v-2.1a5 5 0 0 1-2.7-2.95A5 5 0 0 1 4 7V5h3V3zm0 4H6a3 3 0 0 0 1 2.2V7zm10 0v2.2A3 3 0 0 0 18 7h-1z" />
    </svg>
  );
}

export function UsersIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 19c0-3.6 3.1-6 7-6s7 2.4 7 6v1H2v-1z" />
      <circle cx="17" cy="8.5" r="2.8" opacity="0.75" />
      <path d="M16.5 13.1c3 .3 5.5 2.4 5.5 5.4V20h-4.4v-1c0-2.3-.4-4.3-1.1-5.9z" opacity="0.75" />
    </svg>
  );
}

export function CrownIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7z" />
    </svg>
  );
}

/** Bot : une petite tête ronde à antenne, comme un jeton de café. */
export function BotIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3v3" />
      <circle cx="12" cy="2.6" r="1.1" fill="currentColor" stroke="none" />
      <rect x="4.5" y="6.5" width="15" height="12" rx="5" />
      <circle cx="9.3" cy="12.2" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14.7" cy="12.2" r="1.4" fill="currentColor" stroke="none" />
      <path d="M9.5 15.6c1.5 1 3.5 1 5 0" />
      <path d="M2.5 11v3M21.5 11v3" />
    </svg>
  );
}

/** Une pierre de domino vue de dos, en or, pour compter les pierres d'un joueur. */
export function TileBackIcon({ className }: P) {
  return (
    <svg viewBox="0 0 12 20" className={className} aria-hidden="true">
      <rect x="0.6" y="1.4" width="10.8" height="18" rx="2.4" fill="#6e4b18" />
      <rect x="0.6" y="0.6" width="10.8" height="17.8" rx="2.4" fill="#d9ab4e" stroke="#8a5f1d" strokeWidth="0.8" />
      <path d="M6 5.2l1 2.2 2.3.2-1.8 1.5.6 2.3L6 10.2l-2.1 1.2.6-2.3-1.8-1.5 2.3-.2z" fill="#f6dc95" opacity="0.9" />
      <rect x="1.8" y="1.6" width="8.4" height="2" rx="1" fill="#fff3c4" opacity="0.35" />
    </svg>
  );
}
