# Journal d'avancement d'ICOSIUM

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
