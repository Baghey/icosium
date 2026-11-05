Étape 2 du MVP d'ICOSIUM : le domino algérien double-six. Lis d'abord CLAUDE.md,
docs/PROGRESS.md et la section « Règles du domino algérien (double-six) » de docs/ICOSIUM.md.

Objectif : 4 amis peuvent jouer une vraie partie de domino ensemble, en se parlant au micro.

À faire :

1. Les règles en TypeScript pur dans packages/shared/domino :
   - 28 dominos de 0-0 à 6-6 ; valeur d'un domino = somme de ses deux côtés ;
   - 4 joueurs en deux équipes (coéquipiers face à face), 7 dominos chacun, pas de pioche ;
   - 2 joueurs : 7 dominos chacun, 14 en pioche, on pioche jusqu'à pouvoir jouer ;
   - première manche ouverte par le double-six, manches suivantes par le gagnant de la
     manche précédente avec le domino de son choix ;
   - poser à l'un des deux bouts, passer si aucun domino jouable (à 4) ;
   - fin de manche quand un joueur pose son dernier domino, ou partie bloquée ;
   - score : l'équipe qui ferme marque les points restant dans les mains adverses ; partie
     bloquée : l'équipe avec le moins de points en main gagne et marque les points de l'autre,
     égalité = manche nulle ;
   - partie gagnée au score cible.
2. Les réglages de la table, choisis par le créateur : joueurs (2 ou 4), score cible (51, 101,
   151 ; défaut 101), qui ouvre les manches suivantes, points du gagnant (mains adverses ou
   toutes les mains), temps par tour (15 s, 30 s, illimité ; défaut 30 s).
3. Des tests Vitest complets : distribution, coups valides et interdits, passe, pioche à 2,
   fermeture, partie bloquée, égalité, score cible, temps écoulé (le serveur joue alors le
   premier domino possible ou passe).
4. La salle Colyseus « domino » dans apps/game-server : elle valide chaque coup, envoie à
   chaque joueur uniquement sa propre main (les autres voient seulement le nombre de dominos),
   gère le chronomètre et la reconnexion d'un joueur dans les 60 secondes.
5. L'écran de jeu dans apps/web, mobile d'abord :
   - la chaîne au centre, qui se replie proprement quand elle devient longue ;
   - ta main en bas ; les dominos jouables légèrement surélevés ;
   - toucher un domino puis le bout voulu (ou glisser-déposer) ;
   - les 3 autres joueurs autour, avec leur nombre de dominos et un indicateur « joue » ;
   - le tableau des scores toujours accessible ;
   - le bouton micro toujours visible, relié au salon LiveKit de la table.
6. Les sons : claquement du domino posé, plus fort quand il ferme la manche. Un réglage pour
   couper les sons.
7. Pour cette étape, une page de test simple pour créer une table et y entrer par un code à
   4 lettres suffit. Le vrai lobby arrive à l'étape 3.

C'est terminé quand :

- tous les tests des règles passent ;
- 4 personnes sur 4 appareils jouent une partie complète jusqu'au score cible, en vocal ;
- un joueur qui recharge la page retrouve sa place et sa main ;
- aucune information secrète n'est visible dans les messages réseau du navigateur ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.

Ne fais ni le lobby, ni les bots, ni les autres jeux : ce sont les étapes suivantes.
