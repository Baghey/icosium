# Journal d'avancement d'ICOSIUM

## Étape 2 : le domino algérien (5 novembre 2026)

### Ce qui marche

- **Règles** (`packages/shared/src/domino`) : double-six, 2 joueurs (pioche) ou 4 en équipes,
  ouverture au double-six puis par le gagnant (ou toujours le double-six), passe, partie
  bloquée, égalité, score cible 51/101/151, points « mains adverses » ou « toutes les mains »,
  temps écoulé (le serveur joue le premier domino possible). 29 tests.
- **Serveur** : fonction Supabase `domino` (`supabase/functions/domino`). Elle vérifie chaque
  coup, enregistre l'état complet dans un schéma privé, publie une vue sans aucune main ni
  pioche, et écrit la main de chacun dans une ligne que lui seul peut lire (RLS). Anti-spam :
  5 tables par personne toutes les 10 minutes. 12 tests.
- **Écran de jeu** (`/play/CODE`) : table en bois, dominos ivoire dessinés en SVG, chaîne qui se
  replie en serpent, main en bas avec les dominos jouables surélevés, toucher un domino puis le
  bout voulu, les autres joueurs autour (nombre de dominos, anneau du chrono, bulles « Passe » /
  « +2 »), scores toujours accessibles, fin de manche avec les mains révélées, fin de partie.
- **Animations** : domino qui claque, chaises qui se remplissent, feuilles qui glissent, toutes
  entre 150 et 250 ms et coupées si le téléphone demande moins d'animations.
- **Sons** : claquement (plus fort quand la manche se ferme), petit signal « à toi » ; bouton
  pour couper le son, retenu par le téléphone.
- **Vocal** : chaque table a son salon LiveKit (`table-code`), on y entre micro coupé, retour
  automatique après une coupure.
- **Page « Jouer »** (`/play`) : ouvrir une table avec les réglages, ou rejoindre avec un code
  à 4 lettres. Salle d'attente avec le code en grand et « Partager le code ».
- **Reconnexion** : recharger la page ramène à sa place, avec sa main.

### Vérifié

- `pnpm test` (65 tests), `pnpm typecheck` et le build passent.
- Partie complète à 4 joueurs jusqu'à 51 points (4 manches, 121 coups) jouée par des
  navigateurs automatiques contre une copie locale de Supabase : aucune main d'un autre joueur
  ni la pioche n'est passée dans les messages réseau.
- Rechargement en pleine partie : même main avant et après.
- Captures à 360 px en clair et en sombre.
- Base et fonction `domino` installées sur le projet Supabase en ligne.

### Ce qui reste

- Le test à 4 personnes sur 4 vrais téléphones, en vocal, sur le site en ligne.

### Problèmes connus

- Recharger la page empêche le son du vocal jusqu'au premier toucher de l'écran (règle des
  navigateurs) : un toucher n'importe où le rétablit.
- Conseils Supabase restants, voulus : les invités (anonymes) peuvent lire leurs tables, et
  `is_domino_member` est appelable par les connectés (il ne dit que « suis-je assis ici »).

## Passage sur Supabase, sans Docker (5 novembre 2026)

Décision du propriétaire : plus de Docker. Nakama, Colyseus, Redis, Caddy et le LiveKit local
sont retirés.

### Ce qui marche

- Projet Supabase `icosium` créé à Paris (eu-west-3).
- Base de données (`supabase/migrations/`) : table `profiles` (pseudo, invité ou non) lisible
  par les personnes connectées ; date de naissance rangée dans un schéma `private` que l'app ne
  peut pas lire ; un trigger refuse la création de compte sous 16 ans, avec une date invalide,
  un pseudo invalide, ou un invité qui n'a pas coché « 16 ans ou plus ».
- L'app utilise Supabase Auth : inscription (pseudo vérifié libre avant l'envoi), connexion,
  invité anonyme, déconnexion, session gardée au rechargement.
- Si Supabase demande de confirmer l'email, l'app affiche « ouvre l'email qu'on t'a envoyé ».
- Le jeton vocal est donné par la route `/api/voice/token` après vérification de la session
  Supabase, pour LiveKit Cloud (4 places, anti-spam inchangés).
- Tests, vérification TypeScript et build passent.

Site en ligne : <https://icosium-rho.vercel.app> (Vercel, mis à jour à chaque push sur `main`).
Vérifié par le propriétaire sur son téléphone : mode invité, profil, français, salon vocal, et
Supabase et LiveKit « En ligne ».

### Ce qui reste

- Activer les invités anonymes dans Supabase (un interrupteur dans le tableau de bord).
- Créer le projet LiveKit Cloud et le projet Vercel, puis tester en vrai sur deux appareils.
- Les tests de bout en bout contre Supabase n'ont pas pu tourner depuis l'environnement de
  Claude (accès réseau à supabase.co bloqué) : à faire sur l'adresse Vercel.

### Problèmes connus

- Avec l'email gratuit de Supabase, l'envoi des emails de confirmation est limité à quelques
  emails par heure. Pour les tests, on peut désactiver « Confirm email » dans Supabase.

## Ajout : le français (5 novembre 2026)

- Toute l'interface existe en anglais et en français (`packages/i18n/src/locales/fr.json`).
- L'app prend la langue du téléphone (français si le téléphone est en français), sinon l'anglais.
- On peut changer de langue sur l'écran de connexion et dans Profil ; le choix est retenu.
- Un test vérifie que le français a exactement les mêmes textes que l'anglais.

## Étape 1 : les fondations (5 novembre 2026)

### Ce qui marche

- **Monorepo pnpm** : `apps/web` (PWA Next.js 16), `apps/game-server` (Colyseus 0.16),
  `packages/shared` (logique pure + tests), `packages/i18n` (textes), `infra/` (Docker), `docs/`.
- **Une commande pour les services** : `pnpm infra:up` lance PostgreSQL, Nakama, Redis, LiveKit
  et Caddy (porte d'entrée HTTPS sur le port 8443).
- **Une commande pour l'app** : `pnpm dev` lance l'app web et le serveur de jeu.
- **Comptes Nakama** :
  - inscription par email avec pseudo et date de naissance ;
  - refus sous 16 ans vérifié **par le serveur** (module `infra/nakama/src/main.ts`), pas
    seulement par l'app ; la date de naissance est stockée en privé (lisible par le serveur seul) ;
  - connexion par email ;
  - mode invité en un appui, avec la case « I am 16 or older » obligatoire (vérifiée aussi par
    le serveur) ;
  - la session reste ouverte au rechargement et se rafraîchit seule.
- **Salle vocale de test** (`/voice`) : jusqu'à 4 personnes dans le salon LiveKit `test-room`,
  micro coupé à l'arrivée, 4 chaises avec l'initiale de chacun, anneau vert autour de qui parle,
  gros bouton micro (un appui = ouvert / coupé, appui long = push-to-talk). Une 5e personne reçoit
  « This voice room is full ». Le jeton vocal n'est donné qu'à un compte Nakama valide, avec une
  limite anti-spam de 10 entrées par minute.
- **Barre vocale flottante** : en haut de toutes les pages tant qu'on est dans le salon, avec qui
  parle, le micro et « Leave ». Elle reste active quand on change de page.
- **PWA** : manifeste, icônes provisoires, service worker minimal, installable sur téléphone.
- **Thème** : crème chaud en clair, brun café en sombre (suit le réglage du téléphone), accent
  vert menthe ; couleurs, rayons et tailles en tokens Tailwind dans `apps/web/app/globals.css`.
- **Textes** : tous en anglais dans `packages/i18n/src/locales/en.json`. Le sens d'écriture est
  prévu (`directionOf("ar") === "rtl"`), et l'interface utilise les propriétés CSS logiques.
- **Serveur de jeu** : Colyseus démarre et répond sur `/health` (aucune salle de jeu encore).
- **Accueil** : un encadré « Server status » montre si les comptes, le serveur de jeu et le
  vocal répondent.

### Vérifié

- `pnpm test` : 22 tests passent (âge, noms de salons, traductions, erreurs de connexion,
  limiteur anti-spam, serveur de jeu).
- `pnpm typecheck` et `pnpm --filter @icosium/web build` passent.
- Tests réels avec Docker : inscription refusée à 14 ans, acceptée à 26 ans, invité refusé sans
  la case, mauvais mot de passe refusé, jeton vocal refusé sans compte.
- Test automatique avec deux navigateurs (téléphone simulé, 360 px) : les deux invités entrent
  dans le salon micro coupé, l'un ouvre son micro, l'autre voit « … is talking », passe sur
  Profile et la barre vocale reste là, puis « Leave » libère la chaise.

### Ce qui reste (prochaines étapes)

- Étape 2 : le domino double-six (pas commencé, comme demandé).
- Couper le son d'un autre joueur sans qu'il le sache (prévu avec la table de jeu).
- Police IBM Plex : pour l'instant on utilise la police du système (aucun fichier lourd à
  charger) ; à ajouter en auto-hébergé plus tard.
- Vraies icônes de l'app (les actuelles sont provisoires).

### Problèmes connus

- **Avertissement de sécurité au premier accès** : en local, le certificat HTTPS est
  auto-signé. Il faut accepter l'avertissement une fois sur chaque appareil. C'est normal, et
  indispensable : sans HTTPS, le téléphone refuse l'accès au micro.
- **Chaise fantôme** : si quelqu'un ferme brutalement l'app (sans « Leave »), sa chaise peut
  rester occupée 20 à 30 secondes, le temps que LiveKit constate le départ.
- **Pare-feu Windows** : au premier lancement, Windows peut demander d'autoriser Docker ou Node
  sur le réseau privé. Il faut accepter, sinon le téléphone ne trouve pas l'ordinateur.
- Les Easter eggs ne sont pas recopiés dans `docs/ICOSIUM.md` (ils doivent rester secrets) ;
  la liste reste dans le document d'origine, pour l'étape 8.
