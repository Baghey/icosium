Étape 5 du MVP d'ICOSIUM : la Ronda. Lis d'abord CLAUDE.md, docs/PROGRESS.md et la section
« Règles de la Ronda » de docs/ICOSIUM.md.

Objectif : deuxième jeu, branché sur le même lobby, la même table qui attend et le même vocal.

À faire :

1. Les règles en TypeScript pur dans packages/shared/ronda :
   - jeu français de 40 cartes (52 sans les 8, 9 et 10) : As, 2 à 7, Valet, Dame, Roi ;
     le Valet suit le 7 ; les couleurs ne comptent pas ;
   - 2 joueurs, ou 4 en équipes ; sens inverse des aiguilles d'une montre ;
   - 3 cartes par joueur et 4 cartes visibles sur la table, toutes différentes et ne formant pas
     une suite (sinon on remplace la carte fautive) ; puis 3 cartes à chaque tour de donne,
     rien sur la table ;
   - annonces avant la première carte : ronda (paire) = 1 point, tringa (brelan) = 5 points ;
     la meilleure combinaison gagne tout (tringa bat ronda, puis la plus haute valeur) ;
     annonce oubliée ou fausse = points à l'adversaire ;
   - capture de la carte de même valeur, plus les cartes suivantes en suite montante ;
   - caïda 1 point, deuxième caïda 5, troisième 10 ; missa (table vidée) 1 point, sauf avec la
     dernière carte de la partie ;
   - en fin de manche, les cartes restantes vont au dernier qui a capturé ; 1 point par carte
     au-delà de 20 ;
   - victoire immédiate à 41 points, même en cours de manche (réglage : 25 ou 41).
2. Des tests Vitest pour chaque règle, dont les captures en suite, chaque type de caïda, la
   missa sur la dernière carte et la victoire en cours de manche.
3. La salle Colyseus « ronda » : mêmes garanties que le domino (mains cachées, chronomètre,
   reconnexion). Le serveur détecte seul les ronda et tringa non annoncées.
4. L'écran de jeu : cartes de la table au centre, ta main en bas, un bouton « Announce » visible
   pendant les secondes avant le premier coup, les cartes capturées en pile, une petite
   animation et le mot crié (« one », « five », « ten ») à chaque caïda.
5. Des cartes dessinées pour ICOSIUM, sobres et lisibles sur petit écran.
6. Le bot simple pour les tables où le Patron l'a choisi : il capture le plus de cartes
   possible, sinon il pose sa plus petite carte.
7. La Ronda apparaît dans le choix du jeu à la création d'une table.

C'est terminé quand :

- tous les tests passent ;
- une partie à 4 en équipes se joue jusqu'à 41 points, en vocal ;
- les annonces, les caïdas et la missa comptent juste ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
