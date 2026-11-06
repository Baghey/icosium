# ICOSIUM : cahier des charges

> Transcrit du document partagé par le propriétaire du projet le 5 novembre 2026.
> Les règles des jeux sont à faire valider par des joueurs avant l'étape du jeu concerné :
> corrige ce fichier en premier si une règle change.

## Ce qui rend ICOSIUM différent

La règle d'or : chaque fonctionnalité doit créer une raison de parler à quelqu'un. Les autres
apps optimisent « jouer vite » ; ICOSIUM optimise « revenir voir les mêmes gens ».

| Mécanique | Ce que ça fait | Pourquoi c'est différent |
| --- | --- | --- |
| La table qui attend | Une table à 3/4 reste ouverte avec le vocal actif ; on discute, on lance un mini-jeu d'attente (pile ou face, quiz express) | L'attente devient sociale au lieu d'être un écran de chargement |
| « Appelle quelqu'un » | Bouton qui sonne les amis en ligne, poste dans ton Cercle, ou génère un lien WhatsApp avec la place libre | La recherche de joueurs est une action, pas un algorithme |
| Le Patron du café | Le créateur de la table choisit les règles, le vocal (ouvert / push-to-talk) et qui peut s'asseoir | Chaque table a une personnalité |
| La chaise libre | Les spectateurs écoutent et parlent, et prennent la place si quelqu'un part | Personne ne quitte, on se remplace comme au vrai café |
| Le Kassoul (le pigeon) | Le perdant de la partie porte un badge rigolo jusqu'à la revanche | Crée de la vanne et de la revanche, donc du retour |
| Le carnet de la table | Historique des scores entre les mêmes 4 personnes, sur des mois | La rivalité entre amis vaut plus qu'un classement mondial |
| Les habitués | Une table permanente qui se reforme chaque soir à 21 h et notifie ses membres | Le rendez-vous fixe, comme le café du quartier |
| Fermeture du café | Une option « heures d'ouverture » : le café de ton Cercle ferme la nuit | Protège le sommeil et rend les soirées plus denses |

L'algérianité passe par le son et la langue, pas par le décor : bruit des dominos claqués sur
la table, réactions vocales préenregistrées en darija (« Yaatik saha », « Zid ! »), et interface
en arabe, français et darija écrite en latin.

### Le lobby anti-bots

Une table ne démarre que quand toutes les places sont prises par des humains ; les bots
n'arrivent que si le Patron coche lui-même le bouton.

Pendant l'attente, le vocal est déjà ouvert : le vrai produit, c'est ce moment où trois
personnes discutent en attendant la quatrième. Si personne ne vient après quelques minutes,
l'app propose le bouton bots, sans jamais l'activer seule.

## Catalogue de jeux par vagues

Lancer avec 3 jeux bien faits vaut mieux que 10 jeux moyens : le Refuge vit de tables pleines,
et trop de jeux dispersent les joueurs.

| Vague | Jeu | Joueurs | Pourquoi ici |
| --- | --- | --- | --- |
| 1 (MVP) | Domino algérien double-six | 2 ou 4 | Le jeu emblème, celui qui fait venir |
| 1 (MVP) | Ronda | 2 ou 4 | Le jeu de cartes du café algérien, parties courtes |
| 1 (MVP) | Dama | 2 | Simple à coder, très connu |
| 2 | Ludo « Tchekchayka » (étape 11) | 2 à 4 | Règles validées, tout le monde connaît |
| 2 | Échecs (étape 12) | 2 | Bibliothèques matures, public fidèle |
| 2 | Yiwen (étape 13) | 2 à 8 | Cartes de couleurs, rapide et bruyant ; notre version à nous |
| 2 | Loup-Garou (étape 14) | 6 à 12 | Le jeu 100 % vocal, parfait pour les Cercles |
| 2 | Vingt-et-un, blackjack (étape 15) | 1 à 6 | Court, contre la banque, jetons fictifs seulement |
| 2 | Chkobba | 2 ou 4 | Proche de la Scopa italienne, du code existe déjà |
| 3 | Rami | 2 à 4 | Très joué en famille |
| 3 | Belote / Coinche | 4 | Jouée en équipes de deux |
| 3 | Monopoly (version maison) | 2 à 6 | Long et complexe : à faire une fois la base stable |
| 3 | Pictionary (dessin) | 3 à 10 | Rires garantis en vocal |
| 4 | Backgammon (Tawla) | 2 | Connu au Maghreb et au Moyen-Orient |
| 4 | Codenames-like (mots en darija) | 4 à 8 | Jeu d'équipe, mots locaux |
| 4 | Quiz culturel algérien | 2 à 8 | Football, cuisine, wilayas, cinéma |
| 4 | Puissance 4, Bataille navale | 2 | Faciles, pour les mini-pauses |

Ajout du 6 novembre 2026 : le propriétaire a demandé les échecs, le Loup-Garou, le blackjack et
un jeu de cartes de couleurs comme le jeu le plus connu du genre. Le Ludo « Tchekchayka »
(règles validées le 5 novembre) rejoint la même vague.

- **Ronda** : jeu de cartes (40 cartes) où l'on capture les cartes de même valeur sur la table ;
  les « ronda » (paires en main) et « tringa » (brelans) rapportent des points.
- **Chkobba** : on capture des cartes dont la somme égale sa carte jouée ; vider la table
  rapporte une « chkobba ».
- **Codenames** : deux équipes, un indice d'un mot pour faire deviner plusieurs cartes ; très
  fort en vocal.

**Monopoly : attention au nom.** Monopoly est une marque de Hasbro. Faire notre propre version
(nom, plateau, cartes) avec des quartiers algériens (Bab El Oued, Hydra, Sidi El Houari…) et
une monnaie fictive. Les mécaniques d'achat et de loyer ne sont pas protégées, le nom et le
visuel le sont.

## Règles du domino algérien (double-six)

4 joueurs en deux équipes, 7 dominos chacun, pas de pioche, et l'équipe qui ferme marque les
points des adversaires. Les détails qui varient d'un quartier à l'autre sont des réglages de
table.

**Le matériel**
- 28 dominos, de 0-0 à 6-6, dont 7 doubles.
- Valeur d'un domino = la somme de ses deux côtés (le 6-4 vaut 10).

**La distribution**
- À 4 joueurs : 7 dominos chacun, aucun reste, donc pas de pioche. Les coéquipiers sont assis
  face à face.
- À 2 joueurs : 7 chacun, les 14 restants forment la pioche.

**Le déroulement**
1. Première manche : celui qui a le double-six le pose au centre.
2. Manches suivantes : le gagnant de la manche précédente commence avec le domino de son choix.
3. Chacun à son tour pose un domino dont un côté correspond à l'un des deux bouts de la chaîne.
4. Sans domino jouable : à 4 on passe, à 2 on pioche jusqu'à pouvoir jouer, puis on passe si
   la pioche est vide.
5. La manche s'arrête quand un joueur pose son dernier domino (il « ferme »), ou quand plus
   personne ne peut jouer (partie bloquée).

**Le score**
- L'équipe qui ferme marque la somme des points restant dans les mains des deux adversaires.
- Partie bloquée : chaque équipe compte ses points en main ; la plus faible gagne et marque les
  points de l'autre. Égalité = manche nulle.
- Première équipe à 101 points gagne la partie (réglable : 51, 101, 151).

**Les réglages du Patron de table**

| Réglage | Options | Par défaut |
| --- | --- | --- |
| Joueurs | 2 (avec pioche) · 4 en équipes | 4 en équipes |
| Score cible | 51 · 101 · 151 | 101 |
| Qui ouvre les manches suivantes | Gagnant de la manche · Double-six à chaque fois | Gagnant de la manche |
| Points du gagnant | Mains des adversaires · Toutes les mains, partenaire compris | Mains des adversaires |
| Temps par tour | 15 s · 30 s · illimité entre amis | 30 s |
| Micro | Coupé (on l'active pour parler) · Ouvert · Push-to-talk | Coupé |

**Le micro** : un gros bouton micro toujours visible en bas de la table, avec un anneau qui
s'allume quand tu parles. Tout le monde arrive micro coupé. Un appui = ouvert / coupé ; appui
long = push-to-talk. Chaque joueur peut couper le son d'un autre sans que celui-ci le sache.

> Point à confirmer : pas de règle algérienne officielle écrite, ces règles sont le standard
> maghrébin. À vérifier avec deux ou trois joueurs avant de coder.

## Règles de la Ronda

Jeu français de 40 cartes, à 2 joueurs ou à 4 en équipes ; on capture les cartes de même
valeur et la première équipe à 41 points gagne.

**Le matériel**
- Jeu de 52 cartes sans les 8, 9 et 10, soit 40 cartes : As à 7, puis Valet, Dame, Roi. Le
  Valet suit directement le 7.
- Les couleurs ne comptent pas, seules les valeurs comptent.
- On joue dans le sens inverse des aiguilles d'une montre.

**La distribution**
1. Le donneur distribue 3 cartes à chacun, puis pose 4 cartes face visible sur la table.
2. Ces 4 cartes doivent être toutes différentes et ne pas former une suite ; sinon on remplace
   la carte fautive.
3. Quand tout le monde a joué ses 3 cartes, on redistribue 3 cartes à chacun, sans rien ajouter
   sur la table.

**Les annonces (avant de jouer la première carte)**
- Ronda : une paire en main = 1 point.
- Tringa : un brelan en main = 5 points.
- Si plusieurs joueurs annoncent, la meilleure combinaison gagne tout : tringa bat ronda, puis
  la plus haute valeur gagne.
- Annonce oubliée ou fausse : les points vont à l'adversaire. Bluffer est permis, mais un bluff
  découvert est pénalisé.

**La capture**
- Une carte prend la carte de même valeur sur la table, plus toutes les cartes qui suivent en
  suite montante. Exemple : avec 6, 7, Valet et Roi sur la table, un 6 prend 6, 7 et Valet ; le
  Roi reste car la Dame manque.
- Si ta carte ne prend rien, elle reste sur la table.

**Les coups qui rapportent**

| Coup | Ce qui se passe | Points |
| --- | --- | --- |
| Caïda (« wahed ») | Tu prends la carte que l'adversaire vient de poser, avec la même valeur | 1 |
| Deuxième caïda (« khamsa ») | Le joueur suivant reprend avec une 3e carte identique | 5 |
| Troisième caïda (« achra ») | Une 4e carte identique reprend tout | 10 |
| Missa | Tu vides entièrement la table | 1 |

Avec la dernière carte de la partie, une missa ne compte pas.

**Fin de manche et score**
- Les cartes restant sur la table vont au dernier joueur qui a capturé.
- L'équipe qui a le plus de cartes marque 1 point par carte au-delà de 20 (26 cartes = 6 points).
- La première équipe à 41 points gagne immédiatement, même en pleine manche. Variante courte :
  25 points.

> À coder avec soin : le serveur doit détecter seul les ronda et tringa non annoncées, et l'app
> doit proposer le bouton « annoncer » pendant les quelques secondes avant le premier coup.

## Règles de la Chkobba

40 cartes, à 2 ou à 4 en équipes ; on capture une carte égale ou un groupe dont la somme égale
sa carte, et la première équipe à 21 points gagne.

**Le matériel**
- Jeu de 52 cartes sans les 8, 9 et 10, soit 40 cartes.
- Valeurs : As = 1, 2 à 7 = leur valeur, Dame = 8, Valet = 9, Roi = 10.

**La distribution**
1. 3 cartes à chaque joueur, 4 cartes face visible au centre.
2. Si 3 ou 4 cartes de même valeur sortent au centre, on redistribue.
3. Quand chacun a joué ses 3 cartes, on redonne 3 cartes, rien au centre.

**La capture**
- Ta carte prend une carte de même valeur, ou un groupe de cartes dont la somme égale sa valeur
  (un 7 prend 3 + 4).
- Si une carte seule et un groupe sont possibles, tu dois prendre la carte seule.
- La capture est obligatoire si elle est possible ; sinon ta carte reste au centre.
- Chkobba : vider tout le centre d'un coup = 1 point. Pas de chkobba avec la toute dernière carte.
- En fin de manche, les cartes restantes vont au dernier qui a capturé.

**Le score de chaque manche**

| Point | Condition | Valeur |
| --- | --- | --- |
| Karta | Le plus de cartes (pas de point à 20-20) | 1 |
| Dinari | Le plus de carreaux (pas de point à 5-5) | 1 |
| Bermila | Le plus de 7 ; à égalité, le plus de 6 | 1 |
| Sabâa el haya | Avoir le 7 de carreau | 1 |
| Chkobba | Chaque table vidée | 1 chacune |

Partie en 21 points (réglable : 11 ou 31). À égalité à 21, on joue une manche de plus.

## Autres jeux de cartes : Rami et Belote

Versions courtes pour la vague 3 ; les règles détaillées seront à écrire et à valider avec des
joueurs avant de coder.

**Rami**
- 2 jeux de 52 cartes + jokers, 2 à 4 joueurs, 14 cartes chacun (15 pour le premier joueur).
- À ton tour : tu prends une carte (pioche ou défausse), tu poses des combinaisons si tu peux,
  puis tu défausses une carte.
- Combinaisons : suite d'au moins 3 cartes de la même couleur, ou brelan / carré de même valeur.
  Le joker remplace n'importe quelle carte.
- Première pose : au moins 51 points de combinaisons (réglage courant, à confirmer).
- Le premier qui pose toutes ses cartes gagne la manche ; les autres comptent les points restant
  en main.

**Belote**
- 32 cartes (du 7 à l'As), 4 joueurs en deux équipes, 8 cartes chacun.
- On choisit une couleur d'atout aux enchères ; l'équipe qui la prend doit faire plus de la
  moitié des points.
- À l'atout, le Valet (20) et le 9 (14) sont les cartes les plus fortes.
- Obligation de fournir la couleur demandée, sinon de couper à l'atout.
- « Belote et rebelote » : Roi + Dame d'atout = 20 points bonus.

Autres jeux connus au Maghreb à explorer : Sota, Basra, Tawla (backgammon).

## Règles du Ludo (Tchekchayka)

Validées par le propriétaire le 5 novembre 2026. Disposition des joueurs aux quatre coins, en 2D,
d'après la maquette `/mnt/project-files/apercus-ludo/maquette-ludo.html`.

- 2 à 4 joueurs, 4 pions chacun ; 2 contre 2 possible, partenaires face à face.
- Un pion sort de la maison seulement avec un 6. Un 6 fait rejouer ; trois 6 de suite, le tour
  est perdu.
- Tomber sur un pion adverse le renvoie à sa maison, et on rejoue. Les cases étoilées sont sûres.
- Deux pions de même couleur sur une case ne bloquent rien (pas de mur).
- Il faut le chiffre exact pour entrer au centre.
- Le créateur choisit combien de pions il faut rentrer pour gagner (4 par défaut).
- Le dé est tiré par le serveur.

## Règles des échecs

Règles internationales (FIDE) : roque, prise en passant, promotion, mat, pat, nulles (triple
répétition, 50 coups, matériel insuffisant, accord), abandon.

| Réglage | Options | Par défaut |
| --- | --- | --- |
| Pendule | 3 min + 2 s · 5 min · 10 min · 15 min + 10 s · sans pendule | 10 min |
| Couleur | Au hasard · Le créateur choisit | Au hasard |
| Bot | Non · 3 niveaux, écrit par nous | Non |

Licences : chess.js (BSD-2) et react-chessboard (MIT) sont permis ; chessground et Stockfish sont
en GPL, donc interdits dans l'app. Les pièces sont dessinées maison.

## Règles de Yiwen

Notre jeu de cartes de couleurs : même famille que le jeu le plus connu du genre, mais avec notre
nom, notre paquet et nos dessins. Le nom, le logo et le visuel de ce jeu sont des marques
protégées : ne jamais les utiliser. Le nom « Yiwen » (« un » en tamazight) a été choisi par le propriétaire le
6 novembre 2026.

Proposition détaillée, maquettes et questions encore ouvertes :
`/mnt/project-files/apercus-cartes/regles-cartes.md`.

- 2 à 8 joueurs, 7 cartes chacun ; on retourne une carte chiffre pour commencer.
- Paquet de 104 cartes, 4 familles aux motifs algériens : Chems (soleil, ambre doré), Nakhla
  (palmier, vert jade), Najma (étoile de zellige, bleu faïence), Qaws (arcade de la Casbah, terre
  cuite).

| Carte | Effet | Nombre | Points |
| --- | --- | --- | --- |
| 1 à 9 | Aucun | 2 de chaque par famille (72) | Sa valeur |
| Passe | Le suivant passe son tour | 2 par famille (8) | 20 |
| Sens inverse | Le sens du jeu change (à 2 joueurs, on rejoue) | 2 par famille (8) | 20 |
| +2 | Le suivant pioche 2 cartes et passe son tour | 2 par famille (8) | 20 |
| Joker | On choisit la famille | 4 | 50 |
| Joker +4 | On choisit la famille, le suivant pioche 4 et passe | 4 | 50 |

- On pose une carte de même famille, de même chiffre ou de même symbole ; les jokers se posent sur
  tout ; sinon on pioche.
- Avec une seule carte en main, on appuie sur « Dernière ! ».
- Le premier qui vide sa main gagne la manche.

> Noms des cartes en français simple : le propriétaire a refusé les noms en darija le
> 6 novembre 2026. Les autres réglages (cumul des +2 et +4, oubli de l'annonce, pioche, partie
> aux points) attendent ses réponses aux questions de `regles-cartes.md`.

## Règles du Loup-Garou

6 à 12 joueurs humains, jamais de bot. Le serveur est le meneur de jeu. Le nom « Les Loups-garous
de Thiercelieux » est une marque : on garde seulement le mot « loup-garou » et le principe libre
du jeu (comme « Mafia »).

| Rôle | Pouvoir |
| --- | --- |
| Villageois | Aucun, vote le jour |
| Loup | La nuit, choisit une victime avec les autres loups |
| Voyante | Chaque nuit, découvre le rôle d'un joueur |
| Sorcière | Une potion pour sauver la victime, une pour tuer, une seule fois chacune |
| Chasseur | En mourant, élimine un joueur de son choix |

- La nuit : loups, puis Voyante, puis Sorcière. Le jour : on découvre qui est mort, chacun parle à
  son tour au micro, puis on vote. Égalité au vote : personne n'est éliminé.
- Le village gagne quand tous les loups sont morts ; les loups gagnent quand ils sont aussi
  nombreux que les autres.
- Nombre de loups proposé : 1 loup pour 6 joueurs, 2 de 7 à 9, 3 de 10 à 12 (modifiable).
- Le jeu se joue au micro, pas au chat écrit (choix du propriétaire, 6 novembre 2026).
- Le jour, tour de parole : le serveur ouvre le micro d'un seul joueur à la fois, dans l'ordre du
  cercle, avec un temps limité (30 s par défaut) ; le joueur peut « passer la parole » au suivant
  plus tôt. La nuit, seuls les loups parlent, entre eux. Les morts écoutent sans parler. Ces droits sont donnés par le serveur dans le jeton LiveKit.
- Chaque joueur ne peut lire que son propre rôle (table privée, RLS stricte) ; les loups se
  voient entre eux.

## Règles du Vingt-et-un (blackjack)

**Jetons fictifs seulement, aucun argent réel.** Les jetons s'appellent des « Louz » (amandes).
Ils ne s'achètent pas, ne se vendent pas,
ne s'échangent pas entre joueurs et ne valent rien hors du jeu. Chaque joueur a 1 000 Louz, et
revient à 1 000 chaque jour s'il en a moins. Pas de classement des jetons, pas de mot « casino ».

- 1 à 6 joueurs contre la banque, tenue par le serveur (ce n'est pas un bot qui prend une place).
- Sabot de 4 jeux de 52 cartes, remélangé quand il en reste moins d'un quart.
- As = 1 ou 11, figures = 10. Blackjack (21 en deux cartes) payé 3 pour 2 ; victoire simple
  payée 1 pour 1 ; égalité, la mise est rendue.
- Actions : tirer, rester, doubler sur les deux premières cartes, séparer une paire une fois.
  Pas d'assurance par défaut.
- La banque tire jusqu'à 16 et reste à 17.
- Réglages du créateur : mise minimale et maximale, nombre de jeux dans le sabot.
- Le sabot et la carte cachée de la banque restent sur le serveur.

> Ces règles sont le standard le plus courant ; à valider par le propriétaire.

## UI/UX : simple, solide, jolie

Une règle : chaque écran a une seule action principale, atteignable avec le pouce. Le reste est
secondaire et plus discret.

| Élément | Choix | Pourquoi |
| --- | --- | --- |
| Couleurs | Fond crème chaud ou brun café en mode sombre, une seule couleur d'accent (vert menthe, comme le thé) | Ambiance café, sans folklore |
| Typo | Une police pour le latin et l'arabe, par exemple IBM Plex Sans + IBM Plex Sans Arabic | Lisible dans les deux écritures |
| Arabe | Interface en miroir (de droite à gauche) quand la langue est l'arabe | Indispensable, à prévoir dès le début |
| Matière | Table en bois ou en formica, dominos ivoire, cartes dessinées maison | Le jeu doit ressembler à la vraie table |
| Animations | Courtes (150–250 ms), un domino qui claque, une carte qui glisse | Vivant sans ralentir |
| Sons | Claquement de domino, brouhaha léger de café réglable | Le son porte l'ambiance |
| Accessibilité | Boutons d'au moins 44 px, contraste suffisant, taille de texte réglable | Joueurs de tous âges |

**Les 5 écrans clés du MVP**
1. Accueil (le Café) : tes tables en cours, tes amis en ligne, un gros bouton « Ouvrir une table ».
2. Table qui attend : les chaises (avatars ou chaises vides), le vocal, « Appelle quelqu'un », le
   partage WhatsApp.
3. Table de jeu : le plateau au centre, ta main en bas, les 3 autres joueurs autour, le bouton
   micro toujours visible.
4. Fin de partie : scores, badge du perdant, gros bouton « Revanche ».
5. Profil : avatar, stats par jeu, badges de réputation, carnet des rivalités.

**Barre vocale flottante** : tant que tu es dans un salon vocal, une petite barre reste en haut de
l'écran sur toutes les pages, avec qui parle, ton micro et « Quitter ».

## La messagerie

| Fonction | Détail |
| --- | --- |
| Conversations | Privées (1-1), de groupe, et le salon de chaque Cercle |
| Messages vocaux | Appui long pour enregistrer, comme WhatsApp ; c'est le format préféré en Algérie |
| Invitations dans le chat | Une invitation à une table apparaît comme une carte avec « Rejoindre », pas un simple lien |
| Résultat de partie | Partagé automatiquement dans le groupe : qui a gagné, qui porte le badge |
| Réactions | Emojis rapides + autocollants maison (le thé, le domino claqué, « Zid ») |
| Statut | En ligne, à une table (avec le jeu), en vocal, absent |
| Sécurité | Bloquer, signaler, messages des inconnus mis de côté dans « Demandes » |
| Hors ligne | Messages envoyés dès que la connexion revient, sans erreur visible |

Technique : la messagerie s'appuie sur le chat de Nakama (privé, groupe, historique) ; les
messages vocaux sont des fichiers audio courts stockés à part.

Références UI (pour s'inspirer, pas copier) : Discord pour la barre vocale, WhatsApp pour la
messagerie et les vocaux, Lichess pour la clarté d'un plateau, Jawaker pour les jeux de cartes
arabes en ligne.

## Easter eggs

Les Easter eggs restent secrets : ne pas les lister dans l'app. La liste est dans le journal
interne de l'équipe (document d'origine, section « Easter eggs »), à reprendre à l'étape 8.
Aucune ne doit gêner le jeu ni avantager un joueur.

## Décisions prises (5 novembre 2026)

| Sujet | Décision | Conséquence |
| --- | --- | --- |
| Plateforme | PWA d'abord | Un seul code Next.js, installable sur téléphone ; appli native plus tard |
| Qui code | Claude (Claude Code), le propriétaire en pilote | Code écrit par étapes, dans un dépôt GitHub |
| Modèle économique | Pas encore décidé | Prévoir la place pour des cosmétiques, ne rien vendre au MVP |
| Vocal | Micro coupé par défaut pour tout le monde | Chacun active son micro quand il veut parler |
| Âge minimum | 16 ans | Date de naissance à l'inscription, signalement et blocage visibles partout |
| Langue | Anglais au lancement | Textes dans des fichiers de traduction dès le début |
| Cartes de la Ronda | Jeu français | 40 cartes : As à 7, Valet, Dame, Roi |
| Nouveaux jeux (6 novembre) | Ludo, échecs, Yiwen, Loup-Garou, Vingt-et-un en vague 2 | Étapes 11 à 15, après le MVP |
| Jeu de cartes de couleurs | Notre version, nommée « Yiwen » | Aucun nom, logo ni visuel de la marque connue |
| Blackjack | Jetons fictifs seulement, les « Louz » | Rien à acheter, rien à gagner, retour quotidien à 1 000 Louz |

À confirmer : anglais seul au lancement, c'est voulu ? Le public est surtout algérien ; ajouter
le français coûte peu si les textes sont dans des fichiers de traduction. L'arabe demande une
interface en miroir, prévue dans la structure.

## Ajouts proposés

- Mode « café réel » : un QR code posé dans un vrai café crée un Cercle local.
- Tournois du vendredi : petit tournoi à 8 tables chaque vendredi soir dans chaque Cercle.
- Replay des parties : revoir une manche coup par coup.
- Mode faible connexion : interface sans animations et audio en basse qualité, activé
  automatiquement quand le réseau est mauvais.
- Professeur de règles : une partie guidée pour apprendre la Ronda ou la Chkobba.

## Architecture technique corrigée

> **Mise à jour du 5 novembre 2026** : pour éviter toute installation (Docker), le projet passe
> sur Supabase (comptes, base, temps réel, chat) + Vercel (hébergement) + LiveKit Cloud (vocal).
> Domino, Ronda et Dama étant au tour par tour, les actions sont validées par le serveur et
> l'état est diffusé par Supabase Realtime, sans Colyseus. Le tableau ci-dessous est la version
> d'origine, gardée pour mémoire.

Next.js + Colyseus + Nakama + LiveKit, quatre briques open source.

| Couche | Choix | Rôle | Pourquoi |
| --- | --- | --- | --- |
| Front web + mobile | Next.js + Tailwind, puis React Native (Expo) | Interface, PWA d'abord | La majorité des joueurs seront sur téléphone |
| Moteur de jeu temps réel | Colyseus (Node.js, MIT) | Salles de jeu, état synchronisé, autorité serveur | Activement maintenu |
| Social | Nakama (Go, Apache 2.0) | Comptes, amis, groupes (Cercles), chat, classements, notifications | Évite des mois de code social |
| Vocal | LiveKit (Go, Apache 2.0) | Salons audio WebRTC, mute, modération, détection de parole | Remplace WebRTC maison + Mediasoup + Coturn |
| Base de données | PostgreSQL (ou CockroachDB pour Nakama) | Données persistantes | Nakama accepte les deux |
| Cache / présence | Redis | Tables ouvertes, qui est en ligne | Standard, rapide |

**Comment les briques se parlent** : l'utilisateur se connecte via Nakama, qui lui donne un
jeton. Il crée une table : Colyseus ouvre une salle et LiveKit ouvre un salon audio du même nom.
Le vocal vit dans une couche séparée du jeu, donc il ne coupe pas quand on change de page ou de
partie.

**Vocal sur réseau mobile algérien** : LiveKit utilise le codec Opus, qui reste compréhensible
vers 16–24 kbit/s. Prévoir un serveur TURN (inclus dans LiveKit) pour les réseaux qui bloquent le
peer-to-peer, et héberger si possible en Europe du Sud (Paris, Marseille, Milan).

**Contrat commun des jeux** : chaque jeu est une salle Colyseus qui expose les mêmes points
d'entrée : `minPlayers`, `maxPlayers`, `options` (les réglages du Patron), `onAction()` validé
côté serveur, `playerView()` qui cache les informations secrètes, et `botAllowed` (faux par
défaut).

## Ressources GitHub (référence seulement)

Règle d'ICOSIUM : aucun code n'est copié ; ces dépôts servent uniquement à comprendre comment
un problème a été résolu, puis tout est réécrit. Licences : MIT / Apache / BSD = réutilisable ;
GPL = le code dérivé doit devenir open source ; NC = référence seulement ; pas de LICENSE =
lecture seulement.

| Brique | Dépôt | Licence | Usage |
| --- | --- | --- | --- |
| Moteur multijoueur | colyseus/colyseus | MIT | Base de toutes les tables de jeu |
| Moteur tour par tour (alt.) | boardgameio/boardgame.io | MIT | Plus développé activement |
| Social | heroiclabs/nakama | Apache 2.0 | Comptes, amis, Cercles, chat |
| Vocal | livekit/livekit | Apache 2.0 | Vocal de table, de Cercle et privé |
| Domino | eufelipemateus/domino-game | CC-BY-NC-4.0 | Lecture seulement |
| Échecs (logique) | jhlywa/chess.js | BSD-2 | Validation des coups |
| Échecs (plateau) | lichess-org/chessground | GPL-3.0 | GPL : attention |
| Échecs (exemple) | kushalbhana/Chessmasters-multiplayer | À vérifier | Next.js + WebRTC + spectateurs |
| Dama | oumoussa98/online-dama | À vérifier | Dama marocaine en JS |
| Dama | JohnDev19/Dama-with-AI | MIT | Logique + IA simple |
| Dama | nada-attia/dama | À vérifier | Variante moyen-orientale |
| Loup-Garou | AlecM33/Werewolf | À vérifier | Rôles personnalisés |
| Loup-Garou | SaifOmar/werewolf | À vérifier | React + vocal WebRTC |
| Chkobba / Scopa | garrypas/scoparella.engine | À vérifier | Moteur TypeScript de Scopa |
| Chkobba / Scopa | OMerkel/Scopa | GPL-3.0 | Variantes + serveur |
| Monopoly | lFandoriNl/monopoly | MIT | React + Socket.IO |
| Monopoly | LilConsul/actPoly-monopoly | À vérifier | Achat, hypothèque |
| Backgammon | quasoft/backgammonjs | MIT | Variantes régionales |
| Backgammon | mrlhumphreys/jbackgammon | MIT | Validation des coups |
| Pictionary | ADIthaker/Scribbl | À vérifier | Dessin + vocal |
| Pictionary | alamrumman/Scribbl-clone | À vérifier | React + Tailwind |
| Codenames | JosNun/codenames | MIT | Base pour une version en darija |

Pour la Ronda et le Rami, rien de sérieux en open source : partir du principe de capture de la
Scopa (même jeu de 40 cartes).
