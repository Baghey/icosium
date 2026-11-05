Étape 10 du MVP d'ICOSIUM : mise en ligne et test fermé. Lis d'abord CLAUDE.md, docs/PROGRESS.md
et la section « Feuille de route du MVP » de docs/ICOSIUM.md.

Objectif : mettre ICOSIUM en ligne pour 30 à 50 testeurs, et mesurer si les gens reviennent.

À faire :

1. Propose-moi d'abord 2 ou 3 options d'hébergement avec leur coût mensuel estimé pour 50 à
   500 joueurs, en privilégiant des serveurs proches de l'Algérie (Paris, Marseille, Milan) pour
   la latence. Attends mon choix avant de déployer.
2. Après mon choix : déploiement de la PWA, du serveur Colyseus, de Nakama, de LiveKit (avec
   TURN) et de Redis ; nom de domaine et HTTPS ; sauvegardes quotidiennes de la base.
3. Un script de déploiement en une commande, documenté dans docs/DEPLOY.md, en français simple.
4. Surveillance : alerte si un service tombe, tableau de bord simple (joueurs connectés,
   tables ouvertes, erreurs).
5. Accès sur invitation : codes d'invitation pour le test fermé.
6. Les mesures du test, sans outil tiers intrusif :
   - part des tables qui se remplissent en moins de 5 minutes ;
   - temps moyen d'attente avant le début d'une partie ;
   - part des joueurs qui reviennent la semaine suivante ;
   - part des parties jouées avec des bots ;
   - utilisation du micro (combien l'activent au moins une fois par partie).
   Une page admin affiche ces chiffres par semaine.
7. Un bouton « Send feedback » dans le profil, qui envoie un message à l'équipe.

C'est terminé quand :

- l'app est accessible sur une vraie adresse, installable sur téléphone ;
- 4 personnes dans des villes différentes jouent une partie en vocal sans coupure ;
- la page des mesures affiche des chiffres réels ;
- docs/PROGRESS.md et docs/DEPLOY.md sont à jour.
