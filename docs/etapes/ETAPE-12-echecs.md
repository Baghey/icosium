Étape 12 d'ICOSIUM (vague 2) : les échecs. Lis d'abord CLAUDE.md, docs/PROGRESS.md et la section
« Règles des échecs » de docs/ICOSIUM.md.

Objectif : un jeu à 2 joueurs, au public fidèle, avec la même table qui attend et le même vocal.

À faire :

1. Les règles dans packages/shared/chess. Deux choix possibles, à faire valider par le
   propriétaire avant de commencer (règle « pas de dépendance importante sans demander ») :
   - utiliser la bibliothèque chess.js (licence BSD-2, autorisée) pour valider les coups ;
   - ou écrire notre propre générateur de coups (plus long, mais sans dépendance).
   Ne jamais utiliser chessground ni Stockfish dans l'app : ils sont sous licence GPL.
2. Règles complètes : roque, prise en passant, promotion (choix de la pièce), échec et mat, pat,
   nulle par triple répétition, par la règle des 50 coups, par matériel insuffisant, par accord ;
   abandon.
3. Des tests Vitest : chaque coup spécial, mat, pat, chaque cas de nulle, coup interdit qui
   laisse son roi en échec.
4. Le serveur (fonction Edge `chess`) valide chaque coup et tient les pendules. Réglages du
   créateur : 3 min + 2 s, 5 min, 10 min, 15 min + 10 s, ou sans pendule entre amis. Reconnexion :
   la pendule continue de tourner, avec un délai de grâce court pour une coupure réseau.
5. L'écran : échiquier en bois (noyer et érable) avec filet doré, pièces dessinées maison en SVG
   (style laiton et ivoire, pas de copie de pièces existantes), coups possibles affichés quand on
   touche une pièce, dernier coup surligné, plateau retourné pour les noirs, pendules dorées,
   liste des coups repliable.
6. Animations : pièce qui glisse (150 à 250 ms), petit claquement à la prise, roi qui vacille à
   l'échec.
7. Bot simple, seulement si le créateur l'a activé : petite recherche (deux ou trois coups
   d'avance) écrite par nous, trois niveaux.
8. Les échecs apparaissent dans le choix du jeu à la création d'une table.

Apprendre à jouer (demande du propriétaire, 6 novembre 2026) : un bouton « Apprendre à jouer »
sur la fiche du jeu et à la table d'attente ouvre une partie guidée, pas à pas, jouée seul sur le
téléphone. Voir la section « Apprendre à jouer » de docs/ICOSIUM.md.

C'est terminé quand :

- `pnpm verify` passe ;
- deux personnes jouent une partie complète avec roque, promotion et pendule ;
- la partie guidée se termine sans aide extérieure, par quelqu'un qui ne connaît pas le jeu ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
