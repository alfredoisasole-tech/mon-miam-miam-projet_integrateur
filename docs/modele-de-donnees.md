# Modèle de données de Mon Miam Miam

Modèle conçu à partir du cahier des charges et des règles de la plateforme.

## 1. Entités et attributs

### Conventions

- **Multi-restaurants** : les tables métier portent `restaurant_id` ; les tables « enfants » en héritent par leur table parente.
- **Montants** : entiers en FC (colonnes `*_fc`). **Dates** : texte ISO 8601 en UTC.
- **Identifiants** : `TEXT`. Les booléens sont des `INTEGER` (0 ou 1).
- **Obligatoire** : `oui` = `NOT NULL`. Les valeurs par défaut sont celles du schéma.

### Liste des entités (16)

| Entité | Rôle | Rattachement au restaurant |
|---|---|---|
| `restaurants` | Restaurant : identité visuelle, fuseau horaire et statut. | aucun : c'est le restaurant lui-même |
| `restaurant_settings` | Paramètres d’un restaurant : fidélité, livraison et horaires d’ouverture. Règles de fidélité : 3 000 FC dépensés donnent 1 point ; 15 points donnent une réduction de 3 000 FC. La réduction par défaut est de 3 000 FC. | directe |
| `users` | Comptes des étudiants et du personnel. L’e-mail (sans distinction de casse) et le téléphone sont uniques sur toute la plateforme. | directe |
| `memberships` | Adhésion d’un utilisateur à un restaurant (table d’association) et reliquat de fidélité. | directe |
| `platform_admins` | Administrateurs de la plateforme, hors de tout restaurant. | aucune (plateforme) |
| `menu_items` | Plats et articles de la carte, avec suppression logique (`deleted_at`). | directe |
| `assets` | Fichiers binaires (logos, images) stockés dans la base. | directe |
| `promotions` | Promotions et annonces d’un restaurant, avec période de validité. | directe |
| `orders` | Commandes : type, statut, paiement, montants, points, livraison, avis du client. | directe |
| `order_items` | Lignes d’une commande ; nom, catégorie et prix sont copiés au moment de la commande. | héritée de `menu_items`, `orders` |
| `order_events` | Historique des changements de statut d’une commande. | héritée de `orders`, `users` |
| `payments` | Paiements d’une commande : opérateur mobile, téléphone, montant et statut. | directe |
| `points_ledger` | Journal des points de fidélité ; les crédits sont des lots avec `remaining` et `expires_at`. | directe |
| `referrals` | Parrainages : parrain, filleul, récompense et commande qui l’a déclenchée. | directe |
| `claims` | Réclamations des clients : proposition de décision, puis décision finale. | directe |
| `password_resets` | Demandes de réinitialisation de mot de passe (jeton haché, expiration, utilisation). | héritée de `users` |

### Attributs par entité

#### `restaurants`

Restaurant : identité visuelle, fuseau horaire et statut.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `slug` | TEXT | oui |  | UNIQUE |
| `name` | TEXT | oui |  |  |
| `tagline` | TEXT | non |  |  |
| `logo_asset_id` | TEXT | non |  | FK → `assets` |
| `primary_color` | TEXT | oui | '#cfbd97' |  |
| `secondary_color` | TEXT | oui | '#000000' |  |
| `font_family` | TEXT | oui |  |  |
| `timezone` | TEXT | oui | 'Africa/Kinshasa' |  |
| `created_at` | TEXT | oui |  |  |
| `default_mode` | TEXT | oui | 'light' |  |
| `status` | TEXT | oui | 'active' |  |

#### `restaurant_settings`

Paramètres d’un restaurant : fidélité, livraison et horaires d’ouverture. Règles de fidélité : 3 000 FC dépensés donnent 1 point ; 15 points donnent une réduction de 3 000 FC. La réduction par défaut est de 3 000 FC.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `restaurant_id` | TEXT | oui |  | PK, FK → `restaurants` |
| `spend_per_point_fc` | INTEGER | oui | 3000 |  |
| `points_per_meal` | INTEGER | oui | 15 |  |
| `free_meal_cap_fc` | INTEGER | oui | 3000 |  |
| `points_validity_months` | INTEGER | oui | 12 |  |
| `delivery_enabled` | INTEGER | oui | 1 |  |
| `delivery_fee_fc` | INTEGER | oui | 0 |  |
| `delivery_communes` | TEXT | oui | '[]' |  |
| `opening_hours` | TEXT | oui |  |  |
| `updated_at` | TEXT | oui |  |  |

#### `users`

Comptes des étudiants et du personnel. L’e-mail (sans distinction de casse) et le téléphone sont uniques sur toute la plateforme.

`restaurant_id` est obligatoire : pour un membre du personnel, il indique son restaurant ; pour un étudiant, son restaurant d’origine. Ses autres restaurants figurent dans `memberships`. Les administrateurs de la plateforme sont enregistrés dans `platform_admins`, hors de tout restaurant.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `restaurant_id` | TEXT | oui |  | FK → `restaurants` |
| `role` | TEXT | oui |  |  |
| `name` | TEXT | oui |  |  |
| `email` | TEXT | oui |  | UNIQUE globale, sans casse |
| `phone` | TEXT | oui |  | UNIQUE globale |
| `password_hash` | TEXT | oui |  |  |
| `commune` | TEXT | non |  |  |
| `quartier` | TEXT | non |  |  |
| `address` | TEXT | non |  |  |
| `status` | TEXT | oui | 'active' |  |
| `must_change_password` | INTEGER | oui | 0 |  |
| `referral_code` | TEXT | non |  | UNIQUE |
| `referred_by` | TEXT | non |  | FK → `users` |
| `accepted_terms_at` | TEXT | non |  |  |
| `created_at` | TEXT | oui |  |  |
| `last_login_at` | TEXT | non |  |  |

#### `memberships`

Adhésion d’un utilisateur à un restaurant (table d’association) et reliquat de fidélité.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `user_id` | TEXT | oui |  | PK, FK → `users` |
| `restaurant_id` | TEXT | oui |  | PK, FK → `restaurants` |
| `loyalty_remainder_fc` | INTEGER | oui | 0 |  |
| `created_at` | TEXT | oui |  |  |

#### `platform_admins`

Administrateurs de la plateforme, hors de tout restaurant.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `name` | TEXT | oui |  |  |
| `email` | TEXT | oui |  | UNIQUE |
| `password_hash` | TEXT | oui |  |  |
| `status` | TEXT | oui | 'active' |  |
| `created_at` | TEXT | oui |  |  |
| `last_login_at` | TEXT | non |  |  |

#### `menu_items`

Plats et articles de la carte, avec suppression logique (`deleted_at`).

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `restaurant_id` | TEXT | oui |  | FK → `restaurants` |
| `name` | TEXT | oui |  |  |
| `description` | TEXT | non |  |  |
| `price_fc` | INTEGER | oui |  |  |
| `category` | TEXT | oui |  |  |
| `is_available` | INTEGER | oui | 1 |  |
| `is_daily` | INTEGER | oui | 0 |  |
| `image_asset_id` | TEXT | non |  | FK → `assets` |
| `position` | INTEGER | oui | 0 |  |
| `deleted_at` | TEXT | non |  |  |
| `created_at` | TEXT | oui |  |  |
| `updated_at` | TEXT | oui |  |  |

#### `assets`

Fichiers binaires (logos, images) stockés dans la base.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `restaurant_id` | TEXT | oui |  | FK → `restaurants` |
| `kind` | TEXT | oui |  |  |
| `mime` | TEXT | oui |  |  |
| `data` | BLOB | oui |  |  |
| `size` | INTEGER | oui |  |  |
| `created_at` | TEXT | oui |  |  |

#### `promotions`

Promotions et annonces d’un restaurant, avec période de validité.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `restaurant_id` | TEXT | oui |  | FK → `restaurants` |
| `kind` | TEXT | oui |  |  |
| `title` | TEXT | oui |  |  |
| `description` | TEXT | non |  |  |
| `image_asset_id` | TEXT | non |  | FK → `assets` |
| `starts_at` | TEXT | oui |  |  |
| `ends_at` | TEXT | oui |  |  |
| `is_active` | INTEGER | oui | 1 |  |
| `created_at` | TEXT | oui |  |  |
| `updated_at` | TEXT | oui |  |  |

#### `orders`

Commandes : type, statut, paiement, montants, points, livraison, avis du client.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `restaurant_id` | TEXT | oui |  | FK → `restaurants` |
| `user_id` | TEXT | oui |  | FK → `users` |
| `order_number` | TEXT | oui |  | UNIQUE avec `restaurant_id` |
| `type` | TEXT | oui |  |  |
| `status` | TEXT | oui |  |  |
| `payment_method` | TEXT | oui |  |  |
| `payment_status` | TEXT | oui |  |  |
| `subtotal_fc` | INTEGER | oui |  |  |
| `discount_fc` | INTEGER | oui |  |  |
| `delivery_fee_fc` | INTEGER | oui |  |  |
| `total_fc` | INTEGER | oui |  |  |
| `points_redeemed` | INTEGER | oui | 0 |  |
| `points_earned` | INTEGER | oui | 0 |  |
| `arrival_time` | TEXT | non |  |  |
| `delivery_commune` | TEXT | non |  |  |
| `delivery_quartier` | TEXT | non |  |  |
| `delivery_address` | TEXT | non |  |  |
| `delivery_landmark` | TEXT | non |  |  |
| `delivery_phone` | TEXT | non |  |  |
| `note` | TEXT | non |  |  |
| `idempotency_key` | TEXT | non |  | UNIQUE avec `user_id` |
| `comment` | TEXT | non |  |  |
| `rating` | INTEGER | non |  |  |
| `commented_at` | TEXT | non |  |  |
| `created_at` | TEXT | oui |  |  |
| `updated_at` | TEXT | oui |  |  |
| `completed_at` | TEXT | non |  |  |
| `cancelled_at` | TEXT | non |  |  |

#### `order_items`

Lignes d’une commande ; nom, catégorie et prix sont copiés au moment de la commande.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `order_id` | TEXT | oui |  | FK → `orders` |
| `menu_item_id` | TEXT | oui |  | FK → `menu_items` |
| `name` | TEXT | oui |  |  |
| `category` | TEXT | oui |  |  |
| `unit_price_fc` | INTEGER | oui |  |  |
| `quantity` | INTEGER | oui |  |  |
| `line_total_fc` | INTEGER | oui |  |  |

#### `order_events`

Historique des changements de statut d’une commande.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `order_id` | TEXT | oui |  | FK → `orders` |
| `status` | TEXT | oui |  |  |
| `user_id` | TEXT | non |  | FK → `users` |
| `created_at` | TEXT | oui |  |  |

#### `payments`

Paiements mobiles d’une commande (opérateur, téléphone, montant, statut).

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `restaurant_id` | TEXT | oui |  | FK → `restaurants` |
| `order_id` | TEXT | oui |  | FK → `orders` |
| `operator` | TEXT | oui |  |  |
| `phone` | TEXT | oui |  |  |
| `amount_fc` | INTEGER | oui |  |  |
| `status` | TEXT | oui |  |  |
| `provider_ref` | TEXT | non |  |  |
| `created_at` | TEXT | oui |  |  |
| `updated_at` | TEXT | oui |  |  |

#### `points_ledger`

Journal des points de fidélité ; les crédits sont des lots avec `remaining` et `expires_at`.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `restaurant_id` | TEXT | oui |  | FK → `restaurants` |
| `user_id` | TEXT | oui |  | FK → `users` |
| `kind` | TEXT | oui |  |  |
| `points` | INTEGER | oui |  |  |
| `remaining` | INTEGER | non |  |  |
| `expires_at` | TEXT | non |  |  |
| `order_id` | TEXT | non |  | FK → `orders` |
| `referral_id` | TEXT | non |  | FK → `referrals` |
| `note` | TEXT | non |  |  |
| `created_by` | TEXT | non |  | FK → `users` |
| `created_at` | TEXT | oui |  |  |

#### `referrals`

Parrainages : parrain, filleul, récompense et commande qui l’a déclenchée.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `restaurant_id` | TEXT | oui |  | FK → `restaurants` |
| `referrer_id` | TEXT | oui |  | FK → `users` |
| `referee_id` | TEXT | oui |  | FK → `users`, UNIQUE |
| `status` | TEXT | oui | 'pending' |  |
| `reward_points` | INTEGER | oui | 0 |  |
| `rewarded_order_id` | TEXT | non |  | FK → `orders` |
| `created_at` | TEXT | oui |  |  |
| `rewarded_at` | TEXT | non |  |  |

#### `claims`

Réclamations des clients : proposition de décision, puis décision finale.

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `restaurant_id` | TEXT | oui |  | FK → `restaurants` |
| `user_id` | TEXT | oui |  | FK → `users` |
| `order_id` | TEXT | non |  | FK → `orders` |
| `kind` | TEXT | oui |  |  |
| `subject` | TEXT | oui |  |  |
| `message` | TEXT | oui |  |  |
| `requested_points` | INTEGER | non |  |  |
| `status` | TEXT | oui | 'open' |  |
| `proposed_decision` | TEXT | non |  |  |
| `proposed_response` | TEXT | non |  |  |
| `proposed_by` | TEXT | non |  | FK → `users` |
| `decision` | TEXT | non |  |  |
| `response` | TEXT | non |  |  |
| `resolved_by` | TEXT | non |  | FK → `users` |
| `manager_note` | TEXT | non |  |  |
| `created_at` | TEXT | oui |  |  |
| `updated_at` | TEXT | oui |  |  |
| `resolved_at` | TEXT | non |  |  |

#### `password_resets`

Demandes de réinitialisation de mot de passe (jeton haché, expiration, utilisation).

| Attribut | Type | Obligatoire | Défaut | Clé |
|---|---|---|---|---|
| `id` | TEXT | oui |  | PK |
| `user_id` | TEXT | oui |  | FK → `users` |
| `token_hash` | TEXT | oui |  | UNIQUE |
| `expires_at` | TEXT | oui |  |  |
| `used_at` | TEXT | non |  |  |
| `created_at` | TEXT | oui |  |  |
