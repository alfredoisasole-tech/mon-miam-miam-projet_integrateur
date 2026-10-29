# Rôles et Permissions

Ce document définit les droits d'accès et les actions autorisées pour chaque type d'utilisateur dans l'application Mon Miam Miam.

## Règle générale d'isolation
Chaque personne du personnel (employé, gérant, administrateur de restaurant) est rattachée à un restaurant spécifique via son compte. Elle ne peut voir et gérer que les commandes, le menu, le personnel et les statistiques de **ce restaurant uniquement**. L'administrateur de la plateforme est le seul à avoir une vue globale sur tous les restaurants.

## Tableau des permissions (Rôle × Action)

| Action / Fonctionnalité | Visiteur | Étudiant | Employé | Gérant | Administrateur (Restaurant) | Administrateur (Plateforme) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Voir le menu public et les promotions | Oui | Oui | Oui | Oui | Oui | Oui |
| S'inscrire et se connecter | Oui | Oui | Oui | Oui | Oui | Oui (via route dédiée) |
| Passer une commande (panier) | Non | Oui | Non | Non | Non | Non |
| Payer une commande (en ligne ou espèces) | Non | Oui | Non | Non | Non | Non |
| Consulter son historique de commandes et ses points | Non | Oui (ses propres données) | Non | Non | Non | Non |
| Utiliser un code de parrainage | Non | Oui | Non | Non | Non | Non |
| Déposer une réclamation | Non | Oui (sur ses commandes) | Non | Non | Non | Non |
| Consulter les commandes du restaurant | Non | Non | Oui (son restaurant) | Oui (son restaurant) | Oui (son restaurant) | Non |
| Valider / Faire avancer le statut d'une commande | Non | Non | Oui (son restaurant) | Oui (son restaurant) | Oui (son restaurant) | Non |
| Marquer un plat comme "épuisé" ou "plat du jour" | Non | Non | Oui (son restaurant) | Oui (son restaurant) | Oui (son restaurant) | Non |
| Créer, modifier ou supprimer un plat du menu | Non | Non | Non | Non | Oui (son restaurant) | Non |
| Gérer les promotions et événements (affiches) | Non | Non | Non | Non | Oui (son restaurant) | Non |
| Consulter les statistiques de vente (semaine / global) | Non | Non | Oui (semaine, son restaurant) | Oui (global, son restaurant) | Oui (global, son restaurant) | Non |
| Créer et gérer les comptes employés | Non | Non | Non | Oui (son restaurant) | Oui (son restaurant) | Non |
| Répondre et valider les réclamations | Non | Non | Oui (réponse initiale) | Oui (validation) | Oui (validation) | Non |
| Créer un nouveau restaurant | Non | Non | Non | Non | Non | Oui |
| Désactiver / Réactiver un restaurant | Non | Non | Non | Non | Non | Oui |
| Créer le premier administrateur d'un nouveau restaurant | Non | Non | Non | Non | Non | Oui |

## Notes d'implémentation pour le backend
- Les droits doivent être vérifiés côté serveur à chaque requête, en se basant sur le rôle contenu dans le jeton JWT et l'identifiant du restaurant (`restaurant_id`) associé à l'utilisateur ou extrait de l'URL.
- Un étudiant possède un compte unique pour tous les restaurants, mais ses adhésions (`memberships`) et ses points de fidélité sont strictement isolés par restaurant.
- Toute tentative d'accès à une ressource d'un autre restaurant doit renvoyer une erreur `403 Forbidden` ou `404 Not Found` (pour ne pas divulguer l'existence de la ressource).