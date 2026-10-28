# APP-11 — Concevoir le modèle de données

Ce document présente la synthèse de la conception du modèle de données de Mon Miam Miam. Le détail des attributs, clés, relations et contraintes est dans le [modèle de données complet](./modele-de-donnees.md).

## Entités couvertes

Le modèle comprend 16 entités :

| Entité | Rôle |
|---|---|
| `restaurants` | Restaurants, identité visuelle et statut |
| `restaurant_settings` | Paramètres de fidélité, livraison et horaires |
| `users` | Comptes des étudiants et du personnel |
| `memberships` | Adhésion d’un utilisateur à un restaurant |
| `platform_admins` | Administrateurs de la plateforme |
| `menu_items` | Plats et articles de la carte |
| `assets` | Images et autres fichiers binaires |
| `promotions` | Promotions, événements et jeux |
| `orders` | Commandes, montants, livraison et suivi |
| `order_items` | Articles et prix conservés au moment de la commande |
| `order_events` | Historique des changements de statut |
| `payments` | Paiements et statut de paiement |
| `points_ledger` | Journal des mouvements et lots de fidélité |
| `referrals` | Parrainages et récompenses |
| `claims` | Réclamations et décisions |
| `password_resets` | Demandes de réinitialisation de mot de passe |

## Principes de conception

- Le modèle isole les données métier par restaurant au moyen de `restaurant_id` ou du rattachement à une entité parente.
- Les identifiants sont des `TEXT` ; les dates sont des textes ISO 8601 en UTC.
- Les montants sont des entiers en francs congolais (FC), sans décimales.
- Les booléens sont stockés sous forme d’entiers `0` ou `1`.
- Les comptes ont une identité unique sur la plateforme ; l’e-mail et le téléphone ne peuvent pas être réutilisés.
- Les prix des articles d’une commande sont conservés dans `order_items` au moment de l’achat.
- Les relations, valeurs permises, clés et contraintes numériques sont détaillées dans le document de référence.

## Sous-tâches associées

Cette conception regroupe les travaux associés à APP-31, APP-32 et APP-33. Les décisions structurelles et les règles de cohérence sont décrites dans le modèle complet, qui constitue la référence en cas de divergence avec cette synthèse.

## Points restant à confirmer par l’équipe

- **Jeux et événements** : le modèle ne prévoit pas encore de participation ni de récompense associée à une promotion. Confirmer si une colonne `reward_points` et une entité `participations` sont nécessaires.
- **Paiement** : confirmer si le modèle doit distinguer le paiement par carte du paiement mobile et si l’opérateur de paiement doit être facultatif.

Ces décisions ne sont pas ajoutées au schéma par cette synthèse ; elles sont documentées comme questions ouvertes dans le modèle de référence.
