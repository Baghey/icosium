Étape 4 du MVP d'ICOSIUM : les amis et la messagerie. Lis d'abord CLAUDE.md, docs/PROGRESS.md et
la partie « La messagerie » de la section UI/UX de docs/ICOSIUM.md.

Objectif : on se retrouve, on discute et on s'invite à jouer sans quitter l'app.

À faire :

1. Les amis (Nakama) : rechercher par pseudo, envoyer, accepter ou refuser une demande,
   retirer un ami, bloquer.
2. Le statut de présence : en ligne, à une table (avec le nom du jeu), en vocal, absent.
3. La messagerie (chat Nakama) :
   - conversations privées et de groupe, avec historique ;
   - messages vocaux : appui long pour enregistrer (60 s maximum), lecture avec barre de
     progression ; fichiers audio compressés et stockés à part ;
   - réactions rapides par emoji ;
   - indicateur de lecture et « en train d'écrire » ;
   - les messages envoyés hors ligne partent dès que la connexion revient.
4. Les invitations dans le chat : une invitation à une table s'affiche comme une carte avec le
   jeu, les places libres et un bouton « Join », pas comme un simple lien.
5. Le résultat d'une partie jouée entre membres d'un groupe est posté automatiquement dans ce
   groupe : vainqueurs et score.
6. Les demandes : les messages de personnes qui ne sont pas amies arrivent dans un dossier
   « Requests » séparé, qu'on accepte ou supprime.
7. Signaler un message ou une personne, depuis la conversation.
8. La barre de navigation basse à 5 onglets : Friends, Circles (vide pour l'instant), Games,
   Voice, Profile. La barre vocale flottante reste visible au-dessus.
9. Les appels vocaux privés entre amis (LiveKit), indépendants de toute table.

C'est terminé quand :

- deux comptes deviennent amis, s'écrivent, s'envoient un message vocal et s'appellent ;
- une invitation à une table envoyée dans le chat fait rejoindre la table en un appui ;
- un message d'un inconnu arrive bien dans « Requests » ;
- docs/PROGRESS.md est à jour et tu m'expliques comment tester.
