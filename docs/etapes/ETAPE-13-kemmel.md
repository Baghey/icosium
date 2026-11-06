Étape 13 d'ICOSIUM (vague 2) : « Kemmel », notre jeu de cartes de couleurs. Lis d'abord CLAUDE.md,
docs/PROGRESS.md, la section « Règles de Kemmel » de docs/ICOSIUM.md, et la proposition détaillée
avec ses maquettes : `/mnt/project-files/apercus-cartes/` (`regles-cartes.md`,
`maquette-cartes.html`).

Objectif : un jeu de cartes rapide et bruyant, de la même famille que le jeu de cartes de
couleurs très connu, mais à nous : nom, paquet, dessins et annonce.

Attention à la marque : le nom de ce jeu célèbre, son logo, ses cartes et ses couleurs sont
protégés. Ne jamais les écrire dans l'app, le code ou les textes. Les mécaniques (poser une carte
de même couleur ou de même chiffre) sont libres.

Avant de coder : faire répondre le propriétaire aux questions restantes de `regles-cartes.md`
(nombre de joueurs, cumul des +2 et +4, oubli de l'annonce, pioche, fin de partie, etc.).

À faire :

1. Les règles en TypeScript pur dans packages/shared/kemmel :
   - paquet de 104 cartes : 4 familles (Chems le soleil, Nakhla le palmier, Najma l'étoile,
     Qaws l'arcade), chiffres 1 à 9 en double, et les cartes spéciales « Passe », « Sens inverse »,
     « +2 » (2 par famille), « Joker » et « Joker +4 » (4 chacun) ; pas de zéro ;
   - 7 cartes chacun ; on pose une carte de même famille ou de même chiffre ou de même symbole,
     les jokers se posent sur tout ; sinon on pioche ;
   - avec une seule carte en main, il faut annoncer « Dernière ! » ;
   - le premier qui vide sa main gagne la manche ;
   - les réglages laissés au choix suivent les réponses du propriétaire.
2. Des tests Vitest : chaque carte spéciale, sens inverse à 2 joueurs (le même joueur rejoue),
   annonce oubliée, pioche vide (on remélange la défausse), fin de manche, score.
3. Le serveur (fonction Edge `kemmel`) garde la pioche et les mains dans une table privée :
   personne ne voit les cartes des autres, seulement leur nombre.
4. Les cartes dessinées en SVG par l'app, d'après la maquette : fond ivoire, bord doré, motif de
   la famille au centre, dos vert nuit à étoiles dorées. Aucune ressemblance avec les cartes du
   jeu connu.
5. Animations : carte qui glisse vers la défausse, éventail de la main, flèche du sens qui tourne,
   gros bouton doré « Dernière ! ». Respecter `prefers-reduced-motion`.
6. Bot simple, seulement si le créateur l'a activé.
7. Kemmel apparaît dans le choix du jeu à la création d'une table.

C'est terminé quand :

- `pnpm verify` passe ;
- une partie à 4 se joue jusqu'au bout, en vocal, avec toutes les cartes spéciales ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
