# Contrat d’API — commandes (APP-21)

Ce document définit les échanges du site avec l’API pour créer une commande et en consulter le suivi. Les routes de commande sont montées lorsque l’application reçoit sa base SQLite et utilisent le résolveur d’identité fourni par l’application.

## Conventions communes

- Toutes les routes commencent par `/api`, utilisent JSON UTF-8 et nécessitent un jeton Bearer valide.
- Les routes décrites ici sont réservées au rôle `student`. Le serveur déduit l’étudiant du jeton ; aucun identifiant d’étudiant n’est accepté dans le corps ou la requête.
- Les dates et heures échangées sont au format ISO 8601 en UTC. Les horaires d’ouverture et le jour de numérotation sont interprétés selon l’heure de Kinshasa.
- Les montants sont des entiers en francs congolais (FC). Le navigateur ne transmet aucun prix faisant autorité et ne décide jamais du total.
- Les erreurs suivent la forme commune :

```json
{
  "error": {
    "code": "CODE_STABLE",
    "message": "Message lisible en français.",
    "details": []
  }
}
```

Le code est stable ; le message est en français. Statuts communs : 400 (données invalides), 401 (non connecté), 403 (rôle interdit ou étudiant non adhérent au restaurant choisi), 404 (introuvable), 409 (conflit d’état), 422 (règle métier refusée), 429 (trop de tentatives) et 500 (erreur inattendue sans détail technique).

## Panier côté site — sous-tâche Jira 13.1

Le panier est géré par le site ; aucune route API de panier n’est définie dans cette story. Il contient les plats d’un seul restaurant, de 1 à 20 exemplaires par plat et au plus 30 lignes. Les doublons d’un même plat sont regroupés avant le calcul ; la quantité totale d’un plat reste limitée à 20. Changer de restaurant vide le panier après confirmation. À la validation, le site envoie les identifiants des plats et leurs quantités à `POST /api/orders`. L’API vérifie le restaurant, la disponibilité et recalcule les montants depuis ses propres données.

## Représentation d’une commande

La réponse de détail expose :

- son identifiant et son numéro lisible au format `AAMMJJ-NNN`, attribué par restaurant et par jour ;
- l’identifiant (`slug`) et le nom du restaurant, pour distinguer les commandes dans la liste multi-restaurants ;
- le type et le statut ;
- le moyen et l’état du paiement ;
- les lignes avec leur identifiant de plat, leur nom, leur prix unitaire, leur quantité et leur total calculé ;
- le sous-total, la réduction, les frais de livraison, le total et les points utilisés ou gagnés ;
- l’heure d’arrivée ou les informations de livraison, selon le type ;
- la note facultative, l’avis éventuel (`comment`, `rating`), les dates de création et de mise à jour, les dates de fin ou d’annulation ;
- l’historique des changements de statut avec leurs dates.

Les valeurs de statut d’une commande sont `pending`, `confirmed`, `preparing`, `ready`, `out_for_delivery`, `completed` et `cancelled`. Le parcours normal est `pending` → `confirmed` → `preparing` → `ready` → `completed` pour une commande sur place, et `pending` → `confirmed` → `preparing` → `ready` → `out_for_delivery` → `completed` pour une livraison. L’annulation mène à `cancelled`. Le premier événement d’historique est `pending` à la création.

Les valeurs de paiement sont `cash` ou `mobile_money` ; l’état de paiement est `unpaid`, `pending`, `paid`, `failed` ou `refund_due`. Une commande créée en espèces ou en mobile money débute `unpaid`, sauf si son total est nul : dans ce cas, le serveur la marque `paid`, puisqu’aucun paiement n’est dû. Le démarrage mobile money et la confirmation signée sont décrits dans le [contrat d’API des paiements](paiements.md). Seul le serveur confirme le paiement.

## 1. Créer et valider une commande

### `POST /api/orders`

**Rôles :** `student` connecté.

**Sous-tâche Jira :** 13.2 « Enregistrer et valider la commande ».

**En-têtes requis :**

- `Authorization: Bearer <jeton>`
- `Idempotency-Key` : chaîne de 8 à 64 caractères (`A-Z`, `a-z`, chiffres, `.`, `_`, `:`, `-`), propre à l’étudiant et réutilisée pour rejouer la même tentative après une coupure réseau.

La clé identifie la première tentative de cet étudiant. Si le même étudiant réutilise cette clé avec le même contenu, le serveur renvoie la commande d’origine. Si le contenu diffère, il répond `409 Conflict` avec le code `IDEMPOTENCY_KEY_REUSED` et un message lisible en français. Le serveur compare aux données de la commande enregistrée : restaurant, type, moyen de paiement, plats et quantités après regroupement des doublons, heure d’arrivée ou informations de livraison, note et `redeemMeal`. Une nouvelle commande doit utiliser une nouvelle clé.

**Entrée JSON :**

```json
{
  "restaurant": "restaurant-central",
  "type": "dine_in",
  "paymentMethod": "cash",
  "arrivalTime": "2026-10-26T10:00:00Z",
  "items": [
    {
      "menuItemId": "plat-001",
      "quantity": 2
    }
  ],
  "note": "Sans piment, s’il vous plaît.",
  "redeemMeal": false
}
```

Pour une livraison, remplacer `arrivalTime` par un objet `delivery` :

```json
{
  "restaurant": "restaurant-central",
  "type": "delivery",
  "paymentMethod": "mobile_money",
  "items": [{ "menuItemId": "plat-001", "quantity": 2 }],
  "delivery": {
    "commune": "Limete",
    "quartier": "Industriel",
    "landmark": "Près de la station Engen"
  },
  "note": "Sans piment, s’il vous plaît.",
  "redeemMeal": false
}
```

**Validation :**

| Champ | Règle |
|---|---|
| `restaurant` | Facultatif ; slug d’un restaurant actif auquel l’étudiant est adhérent. S’il est absent, le restaurant d’origine de l’étudiant est utilisé. |
| `type` | Obligatoire ; `dine_in` ou `delivery`. |
| `arrivalTime` | Facultatif pour `dine_in`. S’il est fourni, date ISO 8601 valide, non passée, au plus 12 heures à l’avance et dans les horaires d’ouverture. À omettre pour `delivery`. |
| `delivery` | Obligatoire pour `delivery`. `commune` doit être l’une des 24 communes reconnues de Kinshasa et desservie par le restaurant. Fournir au moins un `landmark` ou une `address`. `phone` est facultatif ; par défaut, le téléphone du compte étudiant est utilisé. `quartier` est facultatif. |
| `paymentMethod` | Facultatif ; `cash` par défaut, ou `mobile_money`. Une commande nouvelle reste `unpaid` jusqu’au traitement du paiement. |
| `items` | Obligatoire ; de 1 à 30 lignes. Chaque ligne contient `menuItemId` et une quantité entière de 1 à 20. Les doublons d’un même plat sont regroupés ; leur quantité cumulée ne dépasse pas 20. |
| `note` | Facultatif ; texte de 300 caractères maximum. |
| `redeemMeal` | Facultatif ; booléen, `false` par défaut. Si `true`, demande une réduction avec les points disponibles dans ce restaurant. |

Le restaurant doit être ouvert au moment de la commande. Toutes les lignes doivent désigner des plats connus, disponibles et rattachés au restaurant choisi. Le serveur recalcule les prix, la réduction, les frais et le total. Les montants et points fournis par le navigateur ne sont jamais acceptés comme source de vérité. Les frais de livraison sont ceux configurés par le restaurant. La réduction par défaut est de 3 000 FC pour 15 points ; elle ne dépasse pas le prix des plats et ne réduit pas les frais de livraison. Les soldes de fidélité restent propres à chaque restaurant.

**Réponses :**

- `201 Created` : nouvelle commande enregistrée.
- `200 OK` : même clé `Idempotency-Key` rejouée par le même étudiant avec le même contenu ; le serveur renvoie la commande d’origine sans créer une seconde commande et ajoute `Idempotent-Replayed: true`.
- `409 Conflict` : même clé `Idempotency-Key` réutilisée par le même étudiant avec un contenu différent.

Exemple de réponse `201` (la réponse `200` contient la commande d’origine) :

```json
{
  "id": "ord_01JAZ8M2Q4",
  "orderNumber": "261026-004",
  "restaurant": { "slug": "restaurant-central", "name": "Restaurant Central" },
  "type": "dine_in",
  "status": "pending",
  "paymentMethod": "cash",
  "paymentStatus": "unpaid",
  "items": [
    {
      "menuItemId": "plat-001",
      "name": "Poulet braisé",
      "unitPriceFc": 3000,
      "quantity": 2,
      "lineTotalFc": 6000
    }
  ],
  "subtotalFc": 6000,
  "discountFc": 0,
  "deliveryFeeFc": 0,
  "totalFc": 6000,
  "pointsRedeemed": 0,
  "pointsEarned": 0,
  "arrivalTime": "2026-10-26T10:00:00Z",
  "delivery": null,
  "note": "Sans piment, s’il vous plaît.",
  "comment": null,
  "rating": null,
  "events": [
    { "status": "pending", "at": "2026-10-26T09:00:00Z" }
  ],
  "createdAt": "2026-10-26T09:00:00Z",
  "updatedAt": "2026-10-26T09:00:00Z",
  "completedAt": null,
  "cancelledAt": null
}
```

**Erreurs :**

| HTTP | Code | Cas |
|---|---|---|
| 400 | `VALIDATION_ERROR` | JSON absent ou invalide, champ requis absent, type ou moyen de paiement inconnu, format de date invalide, clé `Idempotency-Key` absente ou invalide, quantité non entière ou hors limites, panier vide ou plus de 30 lignes. |
| 401 | `UNAUTHORIZED` | Jeton absent ou invalide. |
| 403 | `FORBIDDEN` | Rôle autre que `student` ou absence d’adhésion au restaurant choisi. |
| 404 | `NOT_FOUND` | Slug de restaurant inconnu. |
| 404 | `RESTAURANT_INACTIVE` | Restaurant désactivé. |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Clé déjà utilisée pour une commande au contenu différent. |
| 422 | `ITEM_NOT_FOUND` | Plat inconnu ou ne faisant pas partie du restaurant choisi. |
| 422 | `ITEM_UNAVAILABLE` | Plat connu mais indisponible. |
| 422 | `RESTAURANT_CLOSED` | Restaurant fermé au moment de la commande. |
| 422 | `INVALID_ARRIVAL_TIME` | Heure passée ou au-delà de 12 heures à l’avance. |
| 422 | `OUTSIDE_OPENING_HOURS` | Heure d’arrivée hors des horaires d’ouverture. |
| 422 | `DELIVERY_DISABLED` | Livraison désactivée pour ce restaurant. |
| 422 | `PAYMENT_METHOD_UNAVAILABLE` | Le paiement mobile money n’est pas disponible pour ce restaurant. |
| 422 | `COMMUNE_NOT_SERVED` | Commune non desservie par le restaurant. |
| 422 | `INSUFFICIENT_POINTS` | `redeemMeal` vaut `true`, mais le solde de ce restaurant est insuffisant. |
| 500 | `INTERNAL_ERROR` | Erreur inattendue ; aucun détail technique n’est renvoyé. |

**Scénarios couverts par les tests :** création sur place avec heure d’arrivée, création en livraison, prix recalculés côté serveur, valeurs et limites du panier, plats inconnus/d’un autre restaurant/indisponibles, restaurant fermé ou désactivé, validation des horaires, rejeu idempotent avec le même contenu (`200`) et avec un contenu différent (`409`, sans nouvelle commande), paiement et fidélité.

## 2. Consulter ses commandes

### `GET /api/orders`

**Rôles :** `student` connecté.

**Sous-tâche Jira :** 13.3 « Afficher le suivi de commande ».

**Entrée :** aucun corps. Paramètres facultatifs `status`, `page` et `pageSize`. `page` commence à 1 ; `pageSize` vaut 20 par défaut et est limité à 100. Le filtre `status` accepte les statuts de commande connus. La liste est triée de la plus récente à la plus ancienne et comprend les commandes de l’étudiant dans tous les restaurants, pas seulement le restaurant d’origine.

**Réponse :** `200 OK`, page de commandes de l’étudiant. Les lignes de liste ne contiennent pas l’historique ; celui-ci est renvoyé par le détail.

```json
{
  "items": [
    {
      "id": "ord_01JAZ8M2Q4",
      "orderNumber": "261026-004",
      "restaurant": { "slug": "restaurant-central", "name": "Restaurant Central" },
      "type": "dine_in",
      "status": "preparing",
      "paymentMethod": "cash",
      "paymentStatus": "unpaid",
      "items": [
        {
          "menuItemId": "plat-001",
          "name": "Poulet braisé",
          "unitPriceFc": 3000,
          "quantity": 2,
          "lineTotalFc": 6000
        }
      ],
      "subtotalFc": 6000,
      "discountFc": 0,
      "deliveryFeeFc": 0,
      "totalFc": 6000,
      "pointsRedeemed": 0,
      "pointsEarned": 0,
      "arrivalTime": "2026-10-26T10:00:00Z",
      "delivery": null,
      "note": "Sans piment, s’il vous plaît.",
      "comment": null,
      "rating": null,
      "createdAt": "2026-10-26T09:00:00Z",
      "updatedAt": "2026-10-26T09:05:00Z",
      "completedAt": null,
      "cancelledAt": null
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

**Erreurs :**

| HTTP | Code | Cas |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `page`, `pageSize` ou `status` invalide. |
| 401 | `UNAUTHORIZED` | Jeton absent ou invalide. |
| 403 | `FORBIDDEN` | Rôle autre que `student`. |
| 500 | `INTERNAL_ERROR` | Erreur inattendue. |

**Scénarios couverts par les tests :** pagination par défaut et par page, filtre par statut, commandes de plusieurs restaurants présentes, commandes d’un autre étudiant absentes.

## 3. Consulter une commande et son historique

### `GET /api/orders/:id`

**Rôles :** `student` connecté, propriétaire de la commande.

**Sous-tâche Jira :** 13.3 « Afficher le suivi de commande ».

**Entrée :** identifiant de commande dans le chemin ; aucun corps.

**Réponse :** `200 OK`, objet commande complet avec l’historique chronologique.

```json
{
  "id": "ord_01JAZ8M2Q4",
  "orderNumber": "261026-004",
  "restaurant": { "slug": "restaurant-central", "name": "Restaurant Central" },
  "type": "dine_in",
  "status": "preparing",
  "paymentMethod": "cash",
  "paymentStatus": "unpaid",
  "items": [
    {
      "menuItemId": "plat-001",
      "name": "Poulet braisé",
      "unitPriceFc": 3000,
      "quantity": 2,
      "lineTotalFc": 6000
    }
  ],
  "subtotalFc": 6000,
  "discountFc": 0,
  "deliveryFeeFc": 0,
  "totalFc": 6000,
  "pointsRedeemed": 0,
  "pointsEarned": 0,
  "arrivalTime": "2026-10-26T10:00:00Z",
  "delivery": null,
  "note": "Sans piment, s’il vous plaît.",
  "comment": null,
  "rating": null,
  "events": [
    { "status": "pending", "at": "2026-10-26T09:00:00Z" },
    { "status": "confirmed", "at": "2026-10-26T09:02:00Z" },
    { "status": "preparing", "at": "2026-10-26T09:05:00Z" }
  ],
  "createdAt": "2026-10-26T09:00:00Z",
  "updatedAt": "2026-10-26T09:05:00Z",
  "completedAt": null,
  "cancelledAt": null
}
```

**Erreurs :**

| HTTP | Code | Cas |
|---|---|---|
| 401 | `UNAUTHORIZED` | Jeton absent ou invalide. |
| 403 | `FORBIDDEN` | Rôle autre que `student`. |
| 404 | `NOT_FOUND` | Identifiant inexistant ou commande appartenant à un autre étudiant ; la réponse ne révèle pas qu’elle existe. |
| 500 | `INTERNAL_ERROR` | Erreur inattendue. |

**Scénarios couverts par les tests :** propriétaire autorisé, identifiant inconnu en 404, commande d’un autre étudiant en 404, historique complet dans l’ordre chronologique avec dates ISO 8601 UTC.

## 4. Annuler une commande

### `POST /api/orders/:id/cancel`

**Rôles :** `student` connecté, propriétaire de la commande.

**Sous-tâche Jira :** 13.3 « Afficher le suivi de commande ».

**Entrée :** identifiant de commande dans le chemin ; aucun corps. L’étudiant peut annuler uniquement si le statut est `pending` et si le paiement est `unpaid` ou `failed`. Un paiement mobile money déjà `pending` ne peut pas être annulé par l’étudiant.

**Réponse :** `200 OK`, commande complète avec le statut `cancelled`, la date d’annulation et l’événement correspondant. Les points utilisés sont restitués ; une commande annulée ne gagne pas de points.

```json
{
  "id": "ord_01JAZ8M2Q4",
  "orderNumber": "261026-004",
  "restaurant": { "slug": "restaurant-central", "name": "Restaurant Central" },
  "type": "dine_in",
  "status": "cancelled",
  "paymentMethod": "cash",
  "paymentStatus": "unpaid",
  "items": [
    {
      "menuItemId": "plat-001",
      "name": "Poulet braisé",
      "unitPriceFc": 3000,
      "quantity": 2,
      "lineTotalFc": 6000
    }
  ],
  "subtotalFc": 6000,
  "discountFc": 0,
  "deliveryFeeFc": 0,
  "totalFc": 6000,
  "pointsRedeemed": 0,
  "pointsEarned": 0,
  "arrivalTime": "2026-10-26T10:00:00Z",
  "delivery": null,
  "note": "Sans piment, s’il vous plaît.",
  "comment": null,
  "rating": null,
  "events": [
    { "status": "pending", "at": "2026-10-26T09:00:00Z" },
    { "status": "cancelled", "at": "2026-10-26T09:01:00Z" }
  ],
  "createdAt": "2026-10-26T09:00:00Z",
  "updatedAt": "2026-10-26T09:01:00Z",
  "completedAt": null,
  "cancelledAt": "2026-10-26T09:01:00Z"
}
```

**Erreurs :**

| HTTP | Code | Cas |
|---|---|---|
| 401 | `UNAUTHORIZED` | Jeton absent ou invalide. |
| 403 | `FORBIDDEN` | Rôle autre que `student`. |
| 404 | `NOT_FOUND` | Identifiant inexistant ou commande appartenant à un autre étudiant. |
| 409 | `CANNOT_CANCEL` | Commande déjà confirmée, déjà annulée ou paiement mobile money en attente / déjà payé. |
| 500 | `INTERNAL_ERROR` | Erreur inattendue. |

**Scénarios couverts par les tests :** annulation d’une commande pending non payée, refus après confirmation, refus quand le paiement mobile money est pending ou payé, propriétaire et isolation entre étudiants, restitution des points.

## Scénarios de test de référence

1. Accepter `dine_in` sans `arrivalTime` ; lorsqu’il est fourni, refuser les heures passées, au-delà de 12 heures ou hors horaires.
2. Créer une commande de livraison avec commune desservie et adresse ou repère ; utiliser le téléphone du compte s’il n’est pas fourni.
3. Sans `restaurant`, utiliser le restaurant d’origine ; avec un slug valide, commander dans le restaurant choisi.
4. Vérifier les quantités 1 et 20 ; refuser 0, 21, un nombre non entier, un panier vide, plus de 30 lignes ou plus de 20 exemplaires cumulés d’un plat.
5. Recalculer prix, réduction, frais et total depuis les données serveur.
6. Refuser un plat inconnu ou rattaché à un autre restaurant avec `422 ITEM_NOT_FOUND`.
7. Refuser un plat indisponible avec `422 ITEM_UNAVAILABLE`.
8. Refuser un restaurant fermé avec `422 RESTAURANT_CLOSED` et un restaurant désactivé avec `404 RESTAURANT_INACTIVE`.
9. Refuser une commune non desservie ou une livraison désactivée avec leurs codes métier.
10. Rejouer la même clé `Idempotency-Key` pour le même étudiant avec le même contenu et renvoyer la commande d’origine en `200` avec `Idempotent-Replayed: true`, sans doublon.
11. Rejouer la même clé `Idempotency-Key` pour le même étudiant avec un contenu différent : répondre `409 IDEMPOTENCY_KEY_REUSED`, sans créer de nouvelle commande.
12. Refuser une clé absente ou mal formée en `400` ; isoler les clés de deux étudiants.
13. Créer une commande dans plusieurs restaurants et paginer/filtrer la liste de l’étudiant sans exposer les commandes d’un autre étudiant.
14. Autoriser le propriétaire à lire le détail et répondre `404` pour un identifiant inconnu ou appartenant à un autre étudiant.
15. Renvoyer les événements du détail avec les statuts et dates UTC dans l’ordre chronologique ; ne pas inclure l’historique dans la liste.
16. Autoriser l’annulation uniquement en statut `pending` avec paiement `unpaid` ou `failed` ; restituer les points utilisés.
17. Refuser `redeemMeal` avec `422 INSUFFICIENT_POINTS` si le solde est insuffisant dans le restaurant de la commande.
18. Initialiser `paymentStatus` à `unpaid` pour cash et mobile money ; seul le serveur peut confirmer le paiement.

## Paiement mobile money

Pour les routes de démarrage du paiement et de confirmation signée, consulter le [contrat d’API des paiements](paiements.md).
