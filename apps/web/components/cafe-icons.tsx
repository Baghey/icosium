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
