# Journal d'avancement d'ICOSIUM

## Domino : table « carton de rue » (5 novembre 2026, soir)

D'après la vidéo TikTok du propriétaire (domino du quartier, dehors, le soir).

Ce qui marche :
- La table 3D est un carton beige déchiré (bords mâchés, coin arraché, taches d'humidité, ronds de
  verre de thé, cannelures, traces d'impression, bout de scotch), posé un peu de travers sur une
  table de jardin en plastique blanc, sous un lampadaire. Tout est dessiné au chargement
  (`lib/street-textures.ts`), aucune image à télécharger.
- Le fond de l'écran de jeu est le goudron la nuit (`street-bg`, grain en SVG, lueur du lampadaire).
- Pierres ivoire au clou doré (choix du propriétaire, 5/11 23 h), sur la table comme dans la main ;
  sur la table, les points sont dessinés par-dessus sans éclairage pour rester d'un noir franc.
- Grosses pierres sur la table (choix du propriétaire) : la caméra suit le jeu de près (une pierre
  fait environ 40 px de large, comme dans la main). Elle glisse vers la dernière pierre posée, et à
  mon tour elle cadre mes bouts jouables. Bouton loupe (ou pincer à deux doigts) pour voir toute la table.
- Chaque pierre de la chaîne est posée un peu de travers (moins de 3°, toujours le même angle pour
  la même pierre), comme à la main ; la disposition calculée et ses tests ne changent pas.
- Son du mélange : extrait du son « HQ Sounds » fourni par le propriétaire (`public/sfx/shuffle.mp3`).

Reste à faire / problèmes connus :
- Le repli sans WebGL garde l'ancienne table en feutre.
- Les panneaux de l'interface restent dans le style café (sombre et or).
- Pas de phrases dites à voix haute pendant la partie (refusé par le propriétaire).

## Domino : règles précisées et table en 3D (5 novembre 2026)

- Règles précisées par le propriétaire : la partie se joue en **100 points** (choix 50, 100,
  150). Première manche : le double-six ouvre. Ensuite, c'est le gagnant qui ouvre ; dès que son
  équipe a **dépassé 50 points**, le gagnant et son partenaire se concertent (« ytchawro ») et
  l'un ou l'autre ouvre. Tests ajoutés.
- La chaîne reste d'un seul morceau et tourne au bord de la table (`apps/web/lib/chain-layout.ts`,
  testé : jamais de chevauchement).
- Nouvelle ambiance « café algérien de nuit » choisie par le propriétaire (image de référence),
  avec ses images : fond du café, table, logo, 6 avatars (`apps/web/public/assets`).
- **Table en vraie 3D** (three.js + react-three-fiber + drei + postprocessing, chargés seulement
  sur l'écran de jeu) : feutre, rebord en noyer verni, filet doré, rosette, dominos ivoire en
  relief, lumière de lampe, lueur dorée ; le domino tombe et claque ; mélange des 28 dominos au
  début de chaque manche. Sans WebGL, la table en image reste affichée.
- Page de contrôle visuel en développement : `/dev/table3d?n=12&start=3&ghost=1`.

## Amis, messagerie, nouveau design et nouvelles pierres (5 novembre 2026)

### Ce qui marche

- **Chaîne de domino** : rangées dans la longueur de la table, rien ne sort du feutre, une pierre
  posée ne bouge plus, les doubles en travers (jamais dans un coin), la caméra suit la chaîne,
  halo doré sur les bouts jouables, vibration à la pose.
- **Pierres refaites** : en 3D, ivoire verni au grain d'os léger, arêtes arrondies, points
  vraiment creusés (relief), trait gravé et clou en laiton en relief ; dans la main, même style en
  SVG (gros points creusés, reflet verni, tranche). Page de contrôle : `/dev/tiles` (en local).
- **Design café sur toute l'app** : fond du café flouté partout, couleurs or et brun, navigation
  à 5 onglets (Café, Jouer, Amis, Vocal, Profil) avec pastille de non-lus, nouvel accueil
  (enseigne, grande table de domino, « seul contre des bots », « j'ai un code », amis en ligne,
  derniers messages), pages Jouer, Profil, Vocal et Connexion restylées.
- **Amis** (onglet Amis) : ajouter par pseudo, accepter ou refuser, annuler une demande, retirer,
  bloquer, signaler (raison + détails). Pastille de présence : en ligne, à une table, en vocal.
- **Messagerie façon Messenger** : liste des conversations, demandes de message des inconnus à
  part (l'autre ne sait pas qu'on a lu tant qu'on ne répond pas), bulles groupées, « Vu »,
  « écrit… », envoi immédiat avec réessai tout seul quand le réseau revient.
- **Inviter un ami** depuis la table d'attente : il reçoit une carte « Table de domino » avec
  le code et un bouton « Rejoindre ».
- Sécurité : RLS sur les 6 nouvelles tables, aucune écriture directe (tout passe par des
  fonctions qui vérifient amis, blocages et anti-spam : 30 demandes d'ami par heure,
  20 messages par minute, 20 signalements par jour).

### Vérifié

- `pnpm test` : 92 tests passent ; `pnpm typecheck` et `next build` passent.
- Test automatique à deux navigateurs (360 px) sur une copie locale de Supabase : demande
  d'ami, acceptation, messages, « écrit… », « Vu », badge de non-lus, invitation à une table
  puis « Rejoindre », menu signaler/bloquer.

### Ce qui reste

- Plus tard dans l'étape 4 : messages vocaux, appels privés, groupes, réactions, partage des
  résultats de partie dans les messages, Cercles.
- Signaler / bloquer directement depuis la table de jeu (aujourd'hui : depuis Amis et la
  conversation).

### Problèmes connus

- La base « amis + messages » doit être approuvée dans Supabase avant la mise en ligne.

## Domino : bots, pseudo invité, nouvelles règles (5 novembre 2026)

Demandé par le propriétaire après avoir joué sur son téléphone.

Ce qui marche :
- **Écran de jeu** : les autres joueurs sont dans une rangée au-dessus de la table (avatar, nom,
  pastille dorée avec le nombre de pierres). Plus rien ne cache la table.
- **Jouer seul** : bouton « Jouer seul contre des bots » sur la page Jouer, et « Compléter avec des
  bots » pour le Patron dans la salle d'attente. Les bots ne viennent que sur ce choix explicite
  (`botAllowed` passe à true). Le bot (`chooseBotMove`) joue sur le serveur, en ~1 s, et ne voit que
  ce qu'un joueur verrait : sa main, la table, et qui a passé sur quel chiffre. Sa main n'est jamais
  écrite dans `domino_hands`. Pas de salon vocal quand on est seul avec des bots.
- **Invité** : choix du pseudo à l'entrée (facultatif) et changement dans le Profil
  (`set_guest_username`).
- **6 doubles** dans une main : la donne est annulée et refaite, avec un message.
- **6 pierres d'une même famille** : la manche attend (phase `declare`). Le joueur choisit
  « Redéclarer » (nouvelle donne) ou « Garder » (son équipe ne marque rien sur la manche : si elle
  gagne, les points vont aux adversaires). Sans choix en 20 s, on redistribue. Un bot redéclare.
- **Blocage à égalité** : aucun point, la manche est rejouée (même numéro) et le double-six ouvre.
- Migration `20261105080000_bots_and_guest_names.sql` appliquée en ligne ; fonction `domino` v3
  déployée (envoyée en un seul fichier JavaScript, construit avec esbuild depuis les sources).

Tests : shared 55, fonctions 16, web 11, i18n 7. Parties complètes jouées en local contre les bots
(2D et 3D), captures à 360 px.

Reste / à confirmer avec le propriétaire :
- Les détails de l'easter egg « 6 pierres d'une famille » (6 sur 7 suffisent, seul le joueur
  choisit, redistribution si le temps passe, aussi à 2 joueurs) sont ma lecture : à valider.

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

## Domino plus fluide, mode paysage et vrais sons (5 novembre 2026, soir)

Ce qui marche :
- Vrais sons de dominos (pierre posée en 4 variantes, pierre claquée en fin de manche), générés avec ElevenLabs,
  découpés et au même volume (`apps/web/public/sfx`, 4 à 5 Ko chacun). La synthèse reste en secours.
- Mode paysage sur téléphone : la table est tournée dans la largeur, les joueurs et les boutons sur les côtés.
  Sur Android, l'écran passe en plein écran et se verrouille en paysage dès l'entrée en partie (ou au premier toucher).
  Sur iPhone, un conseil « Tourne ton téléphone » s'affiche. Un bouton permet de revenir en portrait (choix retenu).
- Choix du bout par deux gros boutons « Sur le 3 / Sur le 5 » au-dessus de la main.
- Le message « Attends ton tour » s'efface tout seul et dès que le jeu avance.
- La caméra cadre exactement la chaîne (chaque coin est projeté à l'écran) : plus de pierre coupée en haut.
- Les panneaux du bas (fin de manche, scores) ont un fond plein.

Testé : partie à 4 joueurs humains dans 4 navigateurs (un en paysage, trois en portrait), aucune fuite de main ni de pioche.

Reste : son du mélange (à récupérer depuis le PC du propriétaire), test réel à plusieurs téléphones.

## Analyse vidéo vérifiée et paysage peaufiné (5 novembre 2026, 20 h)

Corrigé :
- Le chrono ne remonte plus (le décalage d'horloge garde la meilleure mesure ; une relecture tardive ne le fausse plus).
- « Tu fermes la manche ! » au lieu de « Toi ferme la manche ! ».
- Quand tu n'as rien à jouer, le serveur te fait passer tout seul et un message le dit.
- Les bots ont un visage qui va avec leur prénom.
- Plus de boutons en double (son, scores) ; un seul bouton « Jouer seul » sur la page Jouer.
- Invité sans pseudo : « Salut ! » + lien « Choisis ton pseudo ».
- Fond sombre dès le premier affichage (plus de flash blanc), marge du bas qui tient compte de la barre du téléphone.
- La table 3D se prépare dès l'arrivée à la table.
- Paysage : mélange propre (les pierres tournent puis s'alignent devant chaque joueur), table entière visible,
  fin de manche sur deux colonnes, pierres de la main plus grandes.

Vérifié et déjà correct : sens des pierres et doubles en travers (nouveau test sur 500 parties au hasard).

## Table fixe et chaîne en spirale (5 novembre 2026, 20 h 30)

- La caméra ne bouge plus : la table entière (rebord compris) est toujours visible, en portrait comme en paysage.
- La chaîne tourne en spirale comme au café : un court tronc au centre, puis chaque bras tourne et longe le bord.
  Les deux bras tournent dans le même sens et gardent chacun leur moitié de table.
- Pierres de la chaîne un peu plus petites (échelle 0,62) pour que tout tienne sur le feutre.
- Testé sur 2000 parties au hasard : aucune pierre ne se chevauche ; dans environ 1 % des très longues chaînes,
  la dernière pierre mord un peu sur le rebord.
