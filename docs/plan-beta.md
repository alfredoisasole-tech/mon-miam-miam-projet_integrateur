# Plan de la version de test (bêta)

Objectif : faire essayer une version de préproduction à un petit groupe pour recueillir des retours avant la version finale.

## 1. Groupe de testeurs

| Rôle | Nombre conseillé | Qui |
|---|---|---|
| Étudiants | 8 à 10 | camarades hors de l'équipe de développement |
| Employé | 1 à 2 | une personne qui joue le service en salle |
| Gérant | 1 | une personne qui suit l'activité |
| Administrateur de restaurant | 1 | une personne qui règle la carte, la charte et les promotions |
| Administrateur de la plateforme | 1 | un membre de l'équipe |

Les testeurs utilisent des comptes de démonstration ou créés pour l'occasion. **Aucune vraie donnée sensible** ne doit être saisie, car la base de la préproduction peut être effacée (voir [deploiement.md](deploiement.md)).

## 2. Environnement

- Site sur Vercel et API sur Render (offres gratuites). Réveiller l'API quelques minutes avant la session en ouvrant `/api/health`.
- Paiement en **mode simulé** et en espèces. Le paiement réel n'est pas testé dans cette bêta.
- Le code de mot de passe oublié apparaît dans les journaux du serveur : un membre de l'équipe le transmet au testeur.

## 3. Scénarios à faire essayer

1. Créer un compte étudiant avec un code de parrainage, puis se connecter.
2. Choisir un restaurant, voir sa charte, parcourir le menu du jour et les promotions.
3. Commander sur place avec une heure d'arrivée, puis commander en livraison.
4. Suivre sa commande, l'annuler tant qu'elle est en attente, noter une commande terminée.
5. Voir ses points, utiliser 15 points pour 3 000 FC de réduction.
6. Parrainer un ami et vérifier le suivi.
7. Déposer une réclamation et lire la réponse.
8. Consulter le top 10 et jouer aux trois mini-jeux.
9. Employé : traiter une commande de l'attente jusqu'à la fin, marquer un plat épuisé, proposer une réponse à une réclamation.
10. Gérant : créer un employé, valider ou renvoyer une proposition, lire les statistiques.
11. Administrateur : changer les couleurs, la police, le logo, les horaires et les règles de fidélité ; créer une promotion ; valider une réclamation de points.
12. Étudiant : exporter ses données et supprimer son compte.
13. Essayer tout cela **sur téléphone** et sur ordinateur.

## 4. Recueil des retours

Chaque testeur remplit un court formulaire par scénario : réussi ou non, difficulté de 1 à 5, remarque libre, appareil et navigateur. Les anomalies sont recopiées dans Jira avec la mention « bêta », une capture et les étapes pour reproduire.

## 5. Critères pour passer à la version finale

- Aucun bug bloquant ni de sécurité ouvert.
- Au moins 80 % des scénarios réussis par la majorité des testeurs.
- Les points de confusion les plus cités sont corrigés ou expliqués dans les manuels.

## 6. Calendrier

Les dates sont fixées par le chef de projet avec l'enseignant ; ce plan n'impose pas d'horaires aux membres de l'équipe. Prévoir une session de test, un temps de correction, puis une courte vérification des correctifs.
