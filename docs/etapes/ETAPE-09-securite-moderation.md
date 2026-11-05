Étape 9 du MVP d'ICOSIUM : sécurité et modération. Lis d'abord CLAUDE.md, docs/PROGRESS.md et la
section « Sécurité, Modération & Protection » de docs/ICOSIUM.md (cahier des charges v1).

Objectif : que l'app soit sûre avant d'y faire entrer de vrais joueurs.

À faire :

1. Revue de sécurité de tout le code existant : authentification, jetons et leur durée,
   validation serveur de chaque action, aucune information secrète envoyée aux clients,
   secrets hors du dépôt. Liste ce que tu as trouvé et corrigé dans docs/SECURITY.md.
2. Limites anti-spam partout : création de tables, messages, invitations, demandes d'amis,
   messages vocaux.
3. Signalements : un écran d'administration simple (réservé aux comptes admin) qui liste les
   signalements avec le contexte (messages, partie), et permet d'avertir, suspendre ou bannir.
4. Modération vocale : le Patron d'une table et les responsables d'un Cercle peuvent couper le
   micro de quelqu'un ou le retirer du salon ; un joueur bloqué ne peut plus rejoindre mes
   tables ni me parler.
5. Protection des 16-17 ans : vocal limité aux tables et Cercles où ils sont invités par des
   amis, pas de messages privés d'inconnus.
6. Compte : modifier son mot de passe, se déconnecter de tous les appareils, supprimer son
   compte et ses données (vraie suppression, avec délai de 7 jours pour annuler).
7. Pages légales en anglais : conditions d'utilisation et politique de confidentialité
   (brouillons clairs, à faire relire par un juriste avant le lancement public).
8. Journaux serveur sans données personnelles inutiles.

C'est terminé quand :

- docs/SECURITY.md liste les points vérifiés et corrigés ;
- un signalement apparaît dans l'écran admin et une suspension bloque bien le compte ;
- la suppression de compte efface les données après le délai ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
