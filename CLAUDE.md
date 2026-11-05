# ICOSIUM — Règles du projet pour Claude Code

## Le projet

ICOSIUM est un réseau social de jeux de société en ligne, avec une identité algérienne
authentique et non folklorique : « le café du coin, en ligne ». On y entre pour jouer,
on y reste pour les gens.

La vision complète, les règles de chaque jeu, l'UI/UX et la feuille de route sont dans
`docs/ICOSIUM.md`. Lis la section concernée avant de travailler sur une fonctionnalité.

Le propriétaire du projet ne code pas. Il pilote, teste et décide.

## Stack

| Couche | Choix |
| --- | --- |
| Front | Next.js (App Router) + TypeScript + Tailwind CSS, livré en PWA installable, hébergé sur Vercel |
| Comptes et données | Supabase : Auth (email + invités anonymes), PostgreSQL avec RLS |
| Jeu temps réel | Tour par tour : actions validées par le serveur (routes API Next.js ou fonctions Postgres), état dans Postgres, diffusion via Supabase Realtime |
| Social | Supabase : amis, Cercles, chat (tables + Realtime), présence (Realtime Presence) |
| Vocal | LiveKit Cloud (salons audio WebRTC) |
| Local | Aucun Docker : `pnpm dev` utilise le projet Supabase en ligne |

Décision du 5 novembre 2026 : Supabase + Vercel + LiveKit Cloud remplacent Nakama, Colyseus,
Redis et Docker, pour que le propriétaire n'ait rien à installer. Le schéma de la base est
versionné dans `supabase/migrations/`.

Ne change pas de brique et n'ajoute aucune dépendance importante sans demander d'abord,
en expliquant pourquoi en une ou deux phrases.

## Structure du dépôt

```
apps/
  web/            PWA Next.js (pages + routes API serveur)
packages/
  shared/         règles des jeux en TypeScript pur + types partagés
  i18n/           fichiers de traduction
supabase/
  migrations/     schéma SQL de la base (tables, RLS, triggers)
docs/
  ICOSIUM.md      cahier des charges complet
  PROGRESS.md     journal d'avancement, mis à jour à chaque étape
```

Gestionnaire de paquets : pnpm (workspaces).

## Règles non négociables

1. **Aucun code copié.** Les dépôts GitHub cités dans `docs/ICOSIUM.md` servent seulement de
   référence pour comprendre une approche. Tout est réécrit pour ICOSIUM.
2. **Le serveur décide de tout.** Chaque action de jeu est validée côté serveur. Le client ne
   reçoit jamais la main des autres joueurs, ni la pioche, ni aucune information secrète.
3. **Pas de bots par défaut.** Une table ne démarre qu'avec le nombre d'humains requis. Les bots
   ne rejoignent une table que si le créateur de la table l'a activé explicitement
   (`botAllowed = false` par défaut).
4. **Micro coupé par défaut, pour tout le monde.** Chacun active son micro quand il veut parler.
   Le vocal vit dans une couche séparée du jeu : il ne se coupe pas quand on change de page.
5. **Aucun texte en dur dans l'interface.** Tous les textes passent par `packages/i18n`.
   Langues livrées : anglais et français. La structure doit permettre d'ajouter l'arabe
   sans réécriture.
6. **Prêt pour l'arabe (droite à gauche).** Utilise les propriétés CSS logiques
   (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start`, `end`) plutôt que left / right.
7. **Mobile d'abord.** Écran de 360 px de large en priorité, zones tactiles d'au moins 44 px,
   action principale atteignable avec le pouce.
8. **Réseaux mobiles faibles.** Pas d'assets lourds au chargement, reconnexion automatique
   aux salles de jeu et au vocal, aucune erreur visible pour une simple coupure courte.
9. **Âge minimum 16 ans.** Date de naissance demandée à l'inscription. Signaler et bloquer
   doivent être accessibles partout où il y a d'autres joueurs.
10. **Sécurité.** Jamais de secret dans le code ou dans le dépôt : tout passe par des variables
    d'environnement, avec un `.env.example` documenté. Limite anti-spam sur la création de
    tables, les messages et les invitations.

## Conventions de code

- TypeScript en mode strict partout.
- Les règles de chaque jeu sont des fonctions pures dans `packages/shared`, sans réseau ni UI,
  et couvertes par des tests Vitest (coups valides, coups interdits, score, fin de partie).
- Chaque jeu suit le même contrat : `minPlayers`, `maxPlayers`, `options` (réglages du créateur
  de la table), validation des actions côté serveur, vue filtrée par joueur, `botAllowed`.
  Les informations secrètes (mains, pioche) ne sont jamais lisibles par un autre joueur :
  règles RLS strictes ou tables privées, jamais de filtrage seulement côté client.
- Toute table Supabase a la RLS activée ; vérifier les conseils de sécurité Supabase après
  chaque migration.
- Petits commits, chacun avec un message clair.

## Design

Ambiance « café contemporain » : chaleureuse, épurée, sans drapeaux ni motifs folkloriques
décoratifs. L'identité passe par les sons, les mots et les détails.

- Fond crème chaud en mode clair, brun café en mode sombre.
- Une seule couleur d'accent : vert menthe.
- Animations courtes (150 à 250 ms).
- Couleurs, rayons et espacements définis comme variables (tokens Tailwind), jamais en dur.

**Le design est une priorité du propriétaire (5 novembre 2026)** : « n'oublie pas le design,
c'est important : de jolis assets, des animations ». À chaque étape :

- Soigner les visuels du jeu : dominos ivoire, cartes dessinées maison, table en bois ou formica,
  avatars, icônes. Assets légers (SVG ou dessinés en CSS de préférence, sinon images compressées),
  jamais de placeholder brut laissé dans une étape livrée.
- Animer ce qui vit : domino qui claque, carte qui glisse, chaise qui se remplit, transitions
  entre écrans, micro qui pulse. Toujours court (150 à 250 ms) et respectant
  `prefers-reduced-motion`.
- Vérifier chaque écran en capture à 360 px, en clair et en sombre, avant de livrer.

## Façon de travailler

- Une étape à la fois, comme demandé dans le message. Ne commence pas l'étape suivante sans
  qu'on te le demande.
- À la fin de chaque étape :
  1. Explique en français simple ce qui a été fait et comment le tester, commande par commande.
  2. Mets à jour `docs/PROGRESS.md` : date, ce qui marche, ce qui reste, problèmes connus.
  3. Vérifie toi-même que tout démarre et que les tests passent avant de dire que c'est fini.
- Si une consigne est floue ou entre en conflit avec ce fichier, pose la question au lieu de
  deviner.
