Étape 3 du MVP d'ICOSIUM : le lobby anti-bots et la table qui attend. Lis d'abord CLAUDE.md,
docs/PROGRESS.md et les sections « Le Refuge » et « Le lobby anti-bots » de docs/ICOSIUM.md.

Objectif : trouver des joueurs devient une action sociale. Une table ne démarre qu'avec des
humains, sauf si son créateur choisit lui-même les bots.

À faire :

1. L'écran d'accueil « le Café » : mes tables en cours, mes amis en ligne (même une liste
   simple pour l'instant), et un gros bouton « Open a table ».
2. Créer une table : choix du jeu (domino pour l'instant), réglages du jeu, table publique ou
   privée. Le créateur est le « Patron » de la table.
3. La table qui attend :
   - les chaises autour de la table, avec les avatars des présents et des chaises vides ;
   - le salon vocal de la table est déjà actif (micro coupé par défaut) ;
   - la partie démarre automatiquement quand toutes les chaises sont prises par des humains,
     après un compte à rebours de 5 secondes que le Patron peut annuler.
4. « Call someone » :
   - notifier mes amis en ligne (notification dans l'app via Nakama) ;
   - un lien d'invitation partageable, avec un bouton qui ouvre WhatsApp avec un message prêt :
     le jeu, le nombre de places libres et le lien ;
   - ouvrir le lien pose directement la personne sur une chaise libre (après connexion).
5. Les bots, seulement sur choix explicite :
   - après 3 minutes avec au moins une chaise vide, l'app propose au Patron « Play with bots
     for the empty seats? » ; elle ne l'active jamais seule ;
   - si le Patron accepte, un bot simple occupe chaque chaise vide ; le bot pose le domino de
     plus forte valeur jouable, avec un délai naturel de 1 à 3 secondes ;
   - un humain peut prendre la place d'un bot entre deux manches ;
   - les parties avec bots sont marquées et ne comptent pas dans les statistiques.
6. Les tables publiques : une liste simple des tables ouvertes avec places libres, filtrable
   par jeu.
7. La chaise libre : on peut entrer comme spectateur, écouter et parler en vocal, sans voir les
   mains des joueurs. Si un joueur part, un spectateur peut prendre sa place entre deux manches.
8. Le Patron peut retirer quelqu'un de la table et changer les réglages tant que la partie n'a
   pas commencé.
9. Limites anti-spam : nombre de tables créées et d'invitations envoyées par minute.

C'est terminé quand :

- une table à 4 ne démarre jamais tant qu'il manque un humain, sauf si le Patron choisit les
  bots ;
- le lien WhatsApp ouvert sur un autre téléphone pose bien la personne à la table ;
- une partie avec 2 humains et 2 bots se joue jusqu'au bout ;
- un spectateur parle en vocal et prend une place libérée ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
