# APP-78 — Protection des fonctions d’administration

Vérification du 3 novembre 2026, réalisée par Emmanuel Mboyo sur `dev`, après intégration de l’API statistiques et des compléments d’authentification et d’isolation.
Ticket : [APP-78](https://judbie2030-45660043.atlassian.net/browse/APP-78).

Le test `backend/tests/platform-access.test.ts` utilise une base SQLite en mémoire et de vrais appels HTTP, avec authentification par `/api/auth/login`. Les comptes et mots de passe sont des données de test locales.

| Contrôle | Résultat attendu et vérifié |
| --- | --- |
| Création d’un restaurant et changement de statut sans connexion ou avec jeton invalide | 401, aucune écriture |
| Mêmes opérations par étudiant, employé, gérant ou administrateur de restaurant | 403, aucune écriture, même si le corps prétend au rôle plateforme |
| Création par l’administrateur de plateforme | 201 ; le premier compte reçoit le rôle `admin` du restaurant créé |
| Désactivation par la plateforme | 200 ; restaurant absent de la liste publique, profil/menu/promotions en 404 ; l’autre restaurant reste visible |
| Nouvelle commande depuis une sélection conservée ou le restaurant par défaut | 404 ; aucune nouvelle commande enregistrée |
| Historique après désactivation | Commandes existantes conservées |
| Réactivation | 200 ; restaurant à nouveau visible et nouvelle commande acceptée |

Les protections existantes satisfont ces contrôles : aucune modification du code métier n’a été nécessaire. La PR ajoute huit tests de non-régression et le présent compte rendu.

Validation avec Node.js 24 : **8 nouveaux tests réussis**, typage TypeScript backend réussi et `git diff --check` réussi.
