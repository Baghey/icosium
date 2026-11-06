Étape 16 d'ICOSIUM (vague 2) : « Houma », notre jeu d'achat de quartiers. Lis d'abord CLAUDE.md,
docs/PROGRESS.md et la section « Règles de Houma » de docs/ICOSIUM.md.

Objectif : un jeu de plateau long et convivial, de la même famille que le célèbre jeu d'achat de
propriétés, mais à nous : nom, plateau, cases, cartes, pions et argent.

Attention à la marque : le nom de ce jeu célèbre, son logo, son plateau, ses noms de rues, ses
personnages, ses cartes et son billet sont protégés. Ne jamais les reprendre dans l'app, le code
ou les textes. Les mécaniques (acheter, louer, construire) sont libres.

Avant de coder : faire valider le nom et les réponses aux questions de règles de docs/ICOSIUM.md.

À faire :

1. Les règles en TypeScript pur dans packages/shared/houma :
   - 2 à 6 joueurs, chacun commence avec la même somme en dinars fictifs, propres à la partie
     (rien à voir avec les Louz, rien à acheter, rien à gagner) ;
   - deux dés tirés par le serveur ; un double fait rejouer, trois doubles envoient au
     commissariat ;
   - plateau de 40 cases : quartiers d'Algérie groupés par ville (la ville complète double les
     loyers et permet de construire), gares et lignes (train, tramway, téléphérique, port),
     services (eau, électricité), cases « Mektoub » (cartes chance), « Kahwa » (pause au café),
     impôts, commissariat ;
   - acheter un quartier libre, payer le loyer chez les autres, construire des maisons puis une
     villa, hypothéquer, échanger entre joueurs ;
   - faillite : le joueur sort ; le dernier qui reste gagne (ou le plus riche au bout du temps,
     selon le réglage).
2. Des tests Vitest : déplacement et passage par le départ, achat, loyer simple et loyer doublé,
   construction équilibrée, hypothèque, cartes Mektoub, commissariat, faillite, fin de partie,
   enchères si elles sont choisies.
3. Le serveur (fonction Edge `houma`) tire les dés, mélange les cartes Mektoub et valide chaque
   action ; l'ordre des cartes reste secret. Chronomètre par tour et reconnexion ; une partie
   longue peut être reprise plus tard.
4. L'écran : plateau dessiné maison en SVG (pas de copie du plateau connu), cases aux couleurs des
   villes, monuments algériens dessinés simplement (Maqam Echahid, pont de Constantine, Santa
   Cruz d'Oran…), pions en laiton, billets en dinars fictifs dessinés maison. Sur 360 px : le
   plateau se zoome sur la case du joueur, avec une vue d'ensemble d'un geste.
5. Animations : dés qui roulent, pion qui avance case par case, maison qui pousse, billets qui
   passent d'un joueur à l'autre. Respecter `prefers-reduced-motion`.
6. Bot simple, seulement si le créateur l'a activé.
7. Houma apparaît dans le choix du jeu à la création d'une table.

C'est terminé quand :

- `pnpm verify` passe ;
- une partie à 4 se joue jusqu'à la faillite de tous sauf un, en vocal ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
