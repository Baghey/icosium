Étape 15 d'ICOSIUM (vague 2) : le Vingt-et-un (blackjack). Lis d'abord CLAUDE.md,
docs/PROGRESS.md et la section « Règles du Vingt-et-un » de docs/ICOSIUM.md.

Objectif : un jeu de cartes court, à plusieurs contre la banque, pour s'amuser ensemble en vocal.

Règle absolue : **aucun argent réel**. Les joueurs ont 16 ans et plus, et les jeux d'argent sont
interdits en Algérie. Les mises se font en jetons fictifs, les « Louz » (amandes) :
- les jetons ne s'achètent jamais, ne se vendent jamais, ne s'échangent pas entre joueurs et ne
  se transforment en rien (ni argent, ni cadeau, ni cosmétique) ;
- chaque joueur reçoit 1 000 Louz, et revient à 1 000 chaque jour s'il en a moins ;
- pas de classement public des jetons, pas de publicité de casino, pas de mot « casino » dans
  l'app.

À faire :

1. Les règles en TypeScript pur dans packages/shared/blackjack :
   - 1 à 6 joueurs humains contre la banque (le serveur tire les cartes de la banque : ce n'est
     pas un bot qui prend une place) ;
   - sabot de 4 jeux de 52 cartes, remélangé quand il reste moins d'un quart ;
   - As = 1 ou 11, figures = 10 ; blackjack (As + figure ou 10 en deux cartes) payé 3 pour 2 ;
   - actions : tirer, rester, doubler (sur les deux premières cartes), séparer une paire (une
     fois) ; pas d'assurance par défaut ;
   - la banque tire jusqu'à 16 et reste à 17 ;
   - réglages du créateur : mise minimale et maximale, nombre de jeux dans le sabot.
2. Des tests Vitest : valeur des mains avec As, blackjack, dépassement de 21, doubler, séparer,
   égalité avec la banque, fin du sabot, retour quotidien à 1 000 jetons.
3. Le serveur (fonction Edge `blackjack`) garde le sabot et la carte cachée de la banque dans une
   table privée. Le solde de jetons n'est modifié que par le serveur (aucune écriture directe).
4. L'écran : table en demi-lune en feutre vert, bordure en noyer, filet doré, jetons en laiton et
   émail dessinés maison, cartes françaises dessinées maison (les mêmes que la Ronda, plus les 8,
   9 et 10). Les joueurs autour, la banque en face.
5. Animations : carte qui glisse du sabot, carte de la banque retournée, jetons qui s'empilent.
6. Le Vingt-et-un apparaît dans le choix du jeu, avec la mention « jetons fictifs, pour le jeu
   seulement ».

C'est terminé quand :

- `pnpm verify` passe ;
- trois personnes jouent plusieurs mains contre la banque, en vocal ;
- il est impossible de changer son solde de jetons autrement qu'en jouant ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
