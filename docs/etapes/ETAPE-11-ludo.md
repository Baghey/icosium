Étape 11 d'ICOSIUM (vague 2) : le Ludo « Tchekchayka ». Lis d'abord CLAUDE.md, docs/PROGRESS.md
et la section « Règles du Ludo (Tchekchayka) » de docs/ICOSIUM.md.

Objectif : un jeu de dé simple et rapide, que tout le monde connaît, pour 2 à 4 joueurs.

À faire :

1. Les règles en TypeScript pur dans packages/shared/ludo (règles validées par le propriétaire
   le 5 novembre 2026, à ne pas changer sans lui) :
   - 2 à 4 joueurs, chacun 4 pions ; 2 contre 2 possible (partenaires face à face) ;
   - un pion ne sort de la maison qu'avec un 6 ;
   - un 6 fait rejouer ; trois 6 de suite : le tour est perdu ;
   - tomber sur un pion adverse le renvoie à sa maison, et on rejoue ;
   - les cases étoilées sont sûres : personne n'y est mangé ;
   - deux pions de même couleur sur une case ne forment pas de mur ;
   - il faut le chiffre exact pour entrer au centre ;
   - le créateur de la table choisit combien de pions il faut rentrer pour gagner (1 à 4,
     4 par défaut).
2. Des tests Vitest : sortie sur 6 seulement, rejouer sur 6, trois 6, manger et rejouer, case
   étoilée, chiffre exact, victoire avec 1, 2, 3 ou 4 pions, partie à 2 contre 2.
3. Le serveur (fonction Edge `ludo`, comme le domino) lance le dé lui-même : le client ne choisit
   jamais le chiffre. Chronomètre par tour, reconnexion, et un coup automatique si le temps est
   écoulé.
4. L'écran en 2D, d'après la maquette validée `/mnt/project-files/apercus-ludo/maquette-ludo.html`
   (joueurs aux quatre coins avec avatar, dé et badge micro, gros micro en bas). Couleurs vives
   validées : rouge #e8412c, vert #14b866, jaune #ffbe12, bleu #1f86e8, en tokens Tailwind.
   Ne pas reprendre le nom ni le look d'une app de Ludo existante.
5. Animations courtes : le dé qui roule, le pion qui saute de case en case, le pion mangé qui
   rentre à la maison. Respecter `prefers-reduced-motion`.
6. Bot simple, seulement si le créateur l'a activé : manger si possible, sinon sortir un pion,
   sinon avancer le pion le plus en danger.
7. Le Ludo apparaît dans le choix du jeu à la création d'une table.

C'est terminé quand :

- `pnpm verify` passe ;
- une partie à 4 et une partie à 2 contre 2 se jouent jusqu'au bout, en vocal ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
