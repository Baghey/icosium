Étape 6 du MVP d'ICOSIUM : la Dama (dames espagnoles). Lis d'abord CLAUDE.md et docs/PROGRESS.md.

Objectif : troisième jeu, à 2 joueurs, avec les règles « normales comme les Espagnols ».

À faire :

1. Les règles en TypeScript pur dans packages/shared/dama (dames espagnoles) :
   - plateau 8 × 8, on joue sur les cases sombres, 12 pions par joueur sur les 3 premières
     rangées ; les blancs commencent ;
   - un pion avance d'une case en diagonale, vers l'avant uniquement ;
   - un pion capture en sautant par-dessus une pièce adverse en diagonale, vers l'avant
     uniquement ; les captures en chaîne continuent tant que c'est possible ;
   - la prise est obligatoire ; s'il y a plusieurs prises possibles, on doit choisir celle qui
     prend le plus de pièces, puis celle qui prend le plus de dames ;
   - un pion qui atteint la dernière rangée devient dame à la fin de son coup ;
   - la dame se déplace en diagonale sur toute la longueur (dame volante), et capture à distance ;
   - les pièces capturées sont retirées à la fin de la chaîne ;
   - on perd quand on n'a plus de pièce ou plus de coup possible ; nulle par accord, ou après
     40 coups de chaque côté sans prise ni mouvement de pion.
2. Note bien dans docs/PROGRESS.md que ces règles sont à faire valider par des joueurs : le
   propriétaire confirmera ou corrigera.
3. Des tests Vitest : prise obligatoire, règle de la prise maximale, chaînes, promotion en fin
   de chaîne, captures de la dame à distance, fin de partie, nulle.
4. La salle Colyseus « dama », avec chronomètre (réglages : 1, 3, 5 minutes par coup ou
   illimité) et reconnexion.
5. L'écran : plateau en bois clair et foncé, toucher une pièce affiche ses coups possibles
   (et seulement les prises quand une prise est obligatoire), dernier coup surligné,
   retournement du plateau pour le joueur noir.
6. Bot simple pour les tables où le Patron l'a choisi : prise maximale, sinon coup aléatoire
   qui ne livre pas de pièce.
7. La Dama apparaît dans le choix du jeu à la création d'une table.

Apprendre à jouer (demande du propriétaire, 6 novembre 2026) : un bouton « Apprendre à jouer »
sur la fiche du jeu et à la table d'attente ouvre une partie guidée, pas à pas, jouée seul sur le
téléphone. Voir la section « Apprendre à jouer » de docs/ICOSIUM.md.

C'est terminé quand :

- tous les tests passent ;
- deux personnes jouent une partie complète avec promotion et prises en chaîne ;
- la partie guidée se termine sans aide extérieure, par quelqu'un qui ne connaît pas le jeu ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
