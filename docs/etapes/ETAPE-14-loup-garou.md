Étape 14 d'ICOSIUM (vague 2) : le Loup-Garou. Lis d'abord CLAUDE.md, docs/PROGRESS.md et la
section « Règles du Loup-Garou » de docs/ICOSIUM.md.

Objectif : le jeu 100 % vocal, de 6 à 12 joueurs, parfait pour les Cercles le soir.

Attention à la marque : « Les Loups-garous de Thiercelieux » est un nom protégé. Le mot
« loup-garou » et le principe du jeu (proche du jeu « Mafia ») sont libres. Ne pas reprendre
leurs cartes, leurs dessins ni leurs noms de rôles inventés.

À faire :

1. Les règles en TypeScript pur dans packages/shared/werewolf :
   - 6 à 12 joueurs humains ; jamais de bot à ce jeu ;
   - rôles de base : Villageois, Loup, Voyante, Sorcière (une potion pour sauver, une pour tuer),
     Chasseur (emporte quelqu'un en mourant) ; le créateur choisit les rôles et le nombre de
     loups (proposition automatique selon le nombre de joueurs) ;
   - la nuit : les loups choisissent une victime ensemble, la Voyante découvre un rôle, la
     Sorcière agit ; le jour : tour de parole au micro, puis vote ; égalité = personne n'est éliminé ;
   - victoire du village quand tous les loups sont morts, victoire des loups quand ils sont
     aussi nombreux que les autres.
2. Des tests Vitest : distribution des rôles, chaque action de nuit, vote et égalité, potions
   utilisées une seule fois, tir du Chasseur, conditions de victoire.
3. Le serveur est le meneur de jeu (fonction Edge `werewolf`) : il distribue les rôles, ouvre et
   ferme chaque phase avec un chronomètre, et compte les votes. Chaque rôle est dans une table
   privée : un joueur ne lit que son propre rôle (RLS stricte). Les loups se voient entre eux.
4. Le vocal suit les phases, décidé par le serveur (droits du jeton LiveKit, jamais seulement
   côté client) :
   - le jour, on parle à tour de rôle (choix du propriétaire, 6 novembre 2026) : le serveur
     donne la parole à un seul joueur à la fois, dans l'ordre du cercle ; seul son micro est
     ouvert, les autres écoutent ; il a un temps limité (45 s par défaut, réglable : 30, 45,
     60 s) et un gros bouton « Je passe la parole » pour donner la main au suivant plus tôt ;
     quand le temps est écoulé, le serveur passe la parole tout seul ;
   - après un tour complet, le vote ; le joueur accusé peut avoir 20 s pour se défendre avant
     le vote final ;
   - pas de chat écrit pendant la partie : tout se dit au micro ;
   - la nuit, seuls les loups peuvent parler, et seulement entre eux ;
   - les morts écoutent sans pouvoir parler jusqu'à la fin de la partie.
5. L'écran : cercle de joueurs autour d'un feu, passage du jour à la nuit (ciel de la Casbah,
   lune), carte de rôle qu'on retourne en la gardant appuyée, vote en touchant un avatar ;
   le joueur qui a la parole est mis en avant (anneau vert qui pulse, chrono doré), avec
   l'ordre de passage visible autour du cercle.
   Les loups restent des loups (le thème « Ghouls » a été refusé par le propriétaire).
6. Un meneur vocal est-il nécessaire ? Non : le serveur annonce les phases à l'écran et par un
   petit son. Pas de voix enregistrée sans l'accord du propriétaire.
7. Le Loup-Garou apparaît dans le choix du jeu, avec un rappel « 6 joueurs minimum ».

C'est terminé quand :

- `pnpm verify` passe ;
- une partie à 6 personnes se joue jusqu'à la victoire d'un camp, avec le tour de parole au
  micro le jour et le vocal de nuit réservé aux loups ;
- un joueur ne peut lire aucun autre rôle que le sien, même en interrogeant la base à la main ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
