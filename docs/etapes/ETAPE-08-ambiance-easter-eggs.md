Étape 8 du MVP d'ICOSIUM : ambiance, finitions et Easter eggs. Lis d'abord CLAUDE.md,
docs/PROGRESS.md et les sections « UI/UX » et « Easter eggs » de docs/ICOSIUM.md.

Objectif : que l'app ressemble à un vrai café, et qu'on ait envie d'en parler.

À faire :

1. Passe de finition sur tous les écrans : espacements, tailles de texte, états vides
   (« no friends online yet »), états de chargement, messages d'erreur clairs, mode sombre
   vérifié partout.
2. Les sons : brouhaha léger de café dans les salons (volume réglable, coupé par défaut en jeu),
   sons des cartes et des dominos, petit son à l'arrivée d'un ami à la table.
3. Les réactions vocales préenregistrées et les autocollants maison (le thé, le domino claqué,
   « Zid ! », « Yaatik saha ») utilisables à table et dans le chat.
4. Le mode faible connexion : activé automatiquement quand le réseau est mauvais, ou à la main ;
   sans animations, audio en basse qualité, images allégées.
5. Les Easter eggs de docs/ICOSIUM.md, tous désactivables dans un fichier de configuration :
   - fermer une manche avec le double-six : claquement plus fort, la table tremble une seconde ;
   - table ouverte depuis plus de 30 minutes sans jouer : le verre de thé du décor ne fume plus ;
   - 5 défaites d'affilée contre les mêmes amis : badge rare « Legendary Kassoul » ;
   - app ouverte entre 3 h et 5 h du matin (heure locale) : le vieux du café dit d'aller dormir ;
   - 7 appuis sur le logo : set de dominos rare débloqué ;
   - « icosium » tapé dans la recherche : anecdote sur l'ancien nom romain d'Alger ;
   - tringa de Rois annoncée à la Ronda : animation spéciale et carte dorée ;
   - 1er avril : points des dominos mélangés pendant 1 heure, désactivable par la table.
   Aucun Easter egg ne doit changer le résultat d'une partie ni donner un avantage.
   Liste-les dans un fichier interne docs/EASTER_EGGS.md, jamais dans l'interface.
6. Accessibilité : contraste, tailles tactiles, lecteur d'écran sur les boutons principaux,
   réglage de la taille du texte.

C'est terminé quand :

- chaque Easter egg se déclenche comme prévu et se désactive par la configuration ;
- le mode faible connexion s'active en simulant un réseau lent ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
