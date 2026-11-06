Étape 13 d'ICOSIUM (vague 2) : « Zid ! », notre jeu de cartes de couleurs. Lis d'abord CLAUDE.md,
docs/PROGRESS.md et la section « Règles de Zid ! » de docs/ICOSIUM.md.

Objectif : un jeu de cartes rapide et bruyant, de la même famille que le jeu de cartes de
couleurs très connu, mais à nous : nom, cartes, dessins et cri d'annonce.

Attention à la marque : le nom de ce jeu célèbre, son logo, ses cartes et ses couleurs sont
protégés. Ne jamais les écrire dans l'app, le code ou les textes. Les mécaniques (poser une carte
de même couleur ou de même chiffre) sont libres.

À faire :

1. Les règles en TypeScript pur dans packages/shared/zid :
   - 2 à 8 joueurs, 7 cartes chacun ;
   - 4 familles (Menthe, Henné, Safran, Indigo), cartes de 0 à 9, et les cartes spéciales :
     « +2 » (le suivant pioche 2 et passe), « Retour » (on change de sens), « Passe » (le suivant
     passe), « Joker » (on choisit la famille), « Joker +4 » (on choisit la famille et le
     suivant pioche 4) ;
   - on pose une carte de même famille ou de même chiffre ou de même symbole, sinon on pioche ;
   - avec une seule carte en main, il faut appuyer sur « Dernière ! » ; un autre joueur qui le
     remarque avant le coup suivant te fait piocher 2 cartes ;
   - la manche finit quand un joueur n'a plus de carte ; il marque les points des mains
     adverses ; partie en 300 points (réglable : 200, 300, 500) ;
   - réglages du créateur : cumuler les +2 et +4 (oui / non, non par défaut), piocher jusqu'à
     pouvoir jouer ou une seule carte (une seule par défaut).
2. Des tests Vitest : chaque carte spéciale, changement de sens à 2 joueurs (« Retour » fait
   rejouer), « Dernière ! » oublié, pioche vide (on remélange la défausse), fin de manche, score.
3. Le serveur (fonction Edge `zid`) garde la pioche et les mains dans une table privée : personne
   ne voit les cartes des autres, seulement leur nombre.
4. Les cartes dessinées maison en SVG : fond ivoire, motifs de zellige, un symbole par famille
   (feuille de menthe, main de henné, fleur de safran, étoile indigo) pour les daltoniens, dos
   doré à rosette. Aucune ressemblance avec les cartes du jeu connu (pas d'ovale, pas de couleurs
   primaires pures).
5. Animations : carte qui glisse vers la défausse, éventail de la main, flèche du sens qui tourne,
   gros « Dernière ! » doré. Respecter `prefers-reduced-motion`.
6. Bot simple, seulement si le créateur l'a activé.
7. Zid ! apparaît dans le choix du jeu à la création d'une table.

C'est terminé quand :

- `pnpm verify` passe ;
- une partie à 4 se joue jusqu'à 300 points, en vocal, avec toutes les cartes spéciales ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
