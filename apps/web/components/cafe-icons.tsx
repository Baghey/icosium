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

/** Le café : un verre de thé à la menthe sur sa soucoupe, avec la vapeur. */
export function CafeIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 9h10l-1.3 9.2a2 2 0 0 1-2 1.8h-3.4a2 2 0 0 1-2-1.8z" />
      <path d="M7.4 12h9.2" opacity="0.6" />
      <path d="M4.5 21h15" />
      <path d="M10 6c0-1 1-1.3 1-2.3M13.5 6c0-1 1-1.3 1-2.3" />
    </svg>
  );
}

/** Jouer : deux dominos penchés. */
export function DominoIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="7" height="14" rx="1.8" transform="rotate(-10 7 12)" />
      <path d="M3.9 12.6l6.9-1.2" transform="rotate(0)" />
      <circle cx="6.6" cy="8.9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="15.6" r="0.9" fill="currentColor" stroke="none" />
      <rect x="13" y="4" width="7" height="14" rx="1.8" transform="rotate(12 16.5 11)" />
      <path d="M13.3 10.4l6.8 1.4" />
      <circle cx="17.4" cy="7.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="14.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="17.6" cy="15" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Amis : deux personnes et une bulle de discussion. */
export function FriendsIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8.5" cy="9" r="3" />
      <path d="M3 19.5c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" />
      <path d="M14.5 4.5h6a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1-1.5 1.5h-2.5l-2.2 1.8v-1.8h-1.3A1.5 1.5 0 0 1 13 9.5V6a1.5 1.5 0 0 1 1.5-1.5z" />
    </svg>
  );
}

/** Micro du salon vocal. */
export function VoiceIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

/** Profil : un buste dans un médaillon. */
export function ProfileIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 18.2c1.2-2 3.1-3 5.5-3s4.3 1 5.5 3" />
    </svg>
  );
}

/** Envoyer un message. */
export function SendIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3.4 20.4 21 12 3.4 3.6l-.1 6.5L15 12 3.3 13.9z" />
    </svg>
  );
}

/** Ajouter un ami. */
export function AddFriendIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="9.5" cy="8.5" r="3.5" />
      <path d="M3 20c.7-3.4 3.2-5.2 6.5-5.2 1.6 0 3 .4 4.1 1.2M18 13v7M14.5 16.5h7" />
    </svg>
  );
}

/** Retour. */
export function BackIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/** Drapeau (signaler) et cercle barré (bloquer). */
export function FlagIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}
export function BlockIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

/** Trois points (plus d'options). */
export function MoreIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  );
}

/** Coche (accepter, vu) et croix (refuser, fermer). */
export function CheckIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
export function CloseIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** Bulle de message. */
export function ChatIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5h16v10H10l-4.5 3.8V15.5H4z" />
      <path d="M8 9.5h8M8 12.3h5" strokeLinecap="round" />
    </svg>
  );
}

/** Un téléphone qui pivote (passer en paysage / en portrait). */
export function RotateIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="9" width="12" height="12" rx="2" transform="rotate(-90 9 15)" />
      <path d="M14 3a7 7 0 0 1 7 7M21 10l-2.2-1.6M21 10l1.4-2.4" />
    </svg>
  );
}

/** Téléphone (appel vocal privé). */
export function PhoneIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" />
    </svg>
  );
}

/** Raccrocher : le combiné couché. */
export function HangUpIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 9c-1.6 0-3.1.3-4.6.8v3.1c0 .4-.2.7-.6.9-1 .5-1.9 1.1-2.6 1.8-.2.2-.4.3-.7.3s-.5-.1-.7-.3L.3 13.1A1 1 0 0 1 0 12.4c0-.3.1-.5.3-.7A16.9 16.9 0 0 1 12 7c4.5 0 8.6 1.8 11.7 4.7.2.2.3.4.3.7s-.1.5-.3.7l-2.5 2.5c-.2.2-.4.3-.7.3s-.5-.1-.7-.3c-.8-.7-1.6-1.3-2.6-1.8a1 1 0 0 1-.6-.9V9.8C15.1 9.3 13.6 9 12 9z" />
    </svg>
  );
}

/** Lecture d'un message vocal. */
export function PlayIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.7L9.5 4.6A1 1 0 0 0 8 5.5z" />
    </svg>
  );
}

export function PauseIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4.2" height="14" rx="1.2" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="1.2" />
    </svg>
  );
}

/** Corbeille (annuler un enregistrement). */
export function TrashIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.9 12.2c.1.9.8 1.6 1.7 1.6h5.8c.9 0 1.6-.7 1.7-1.6L17.5 7M10 11v6M14 11v6" />
    </svg>
  );
}

/** Groupe : trois têtes. */
export function GroupIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <circle cx="5.2" cy="10" r="2.3" />
      <circle cx="18.8" cy="10" r="2.3" />
      <path d="M6.5 20c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5M1.5 18.5c.3-2 1.6-3.2 3.4-3.4M22.5 18.5c-.3-2-1.6-3.2-3.4-3.4" />
    </svg>
  );
}

/** Ajouter une réaction. */
export function SmileIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.2 14.2c1 1.4 2.3 2.1 3.8 2.1s2.8-.7 3.8-2.1" />
      <circle cx="9" cy="9.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Son coupé (pour moi) d'un joueur. */
export function SpeakerOffIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5" />
    </svg>
  );
}

export function SpeakerIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9a4.5 4.5 0 0 1 0 6M18.8 6.5a8 8 0 0 1 0 11" />
    </svg>
  );
}

/** Flèche vers le bas (réduire l'écran d'appel). */
export function ChevronDownIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  );
}
