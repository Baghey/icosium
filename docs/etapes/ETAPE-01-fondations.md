Étape 1 du MVP d'ICOSIUM : les fondations. Lis d'abord CLAUDE.md et la section
« Architecture technique corrigée » de docs/ICOSIUM.md.

Objectif : qu'on puisse créer un compte, ouvrir l'app sur téléphone et parler à 4 dans une
salle vocale. Aucun jeu pour l'instant.

À faire :

1. Le monorepo pnpm avec la structure décrite dans CLAUDE.md (apps/web, apps/game-server,
   packages/shared, packages/i18n, infra, docs).
2. infra/docker-compose.yml qui lance Nakama + PostgreSQL, LiveKit et Redis en local, avec un
   .env.example documenté.
3. apps/web : une PWA Next.js installable (manifest, icônes provisoires, mode clair et sombre
   avec les couleurs de CLAUDE.md).
4. Comptes via Nakama : inscription et connexion par email avec date de naissance (refus sous
   16 ans), plus un mode invité pour tester vite.
5. Une page de test « Voice room » : jusqu'à 4 personnes rejoignent le même salon LiveKit,
   micro coupé à l'arrivée, gros bouton micro, indicateur de qui parle.
6. La barre vocale flottante : elle reste visible en haut de l'écran quand on change de page,
   avec qui parle, le bouton micro et « Leave ».
7. apps/game-server : un serveur Colyseus minimal qui démarre et répond, sans salle de jeu.
8. Tous les textes de l'interface en anglais, dans packages/i18n.

C'est terminé quand :

- une seule commande lance tout en local, et une autre lance l'app ;
- je peux ouvrir l'app sur deux appareils (ordinateur + téléphone), me connecter, entrer dans
  la même salle vocale et parler, micro coupé au départ ;
- la barre vocale reste active quand je navigue entre deux pages ;
- docs/PROGRESS.md est créé, et tu m'expliques en français simple comment tout tester.

Ne commence pas le domino : ce sera l'étape 2.
