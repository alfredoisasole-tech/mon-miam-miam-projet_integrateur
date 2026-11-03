# Contrat d'API — réclamations

Ce document décrit le dépôt, le traitement et le suivi des réclamations. Une réclamation appartient à **un restaurant** : elle n'est visible que par son auteur et par le personnel de ce restaurant.

## Circuit

1. L'étudiant dépose une réclamation (état `open`).
2. Un employé **propose** une réponse (état `pending_validation`). La proposition reste interne : l'étudiant ne voit ni la décision ni le texte.
3. Le gérant (ou l'administrateur) **valide** la proposition (état `resolved`) ou la **renvoie** avec une consigne (retour à `open`, la proposition est effacée et la consigne est conservée dans `managerNote`).
4. L'administrateur peut aussi répondre directement, ou corriger la proposition, au moment de valider.
5. Les réclamations de **points** (`kind: "points"`) sont tranchées par l'**administrateur** seul. S'il accepte, il accorde entre 1 et le nombre de points demandés ; ils sont crédités dans le restaurant de la réclamation, avec la durée de validité du restaurant.

L'étudiant voit l'état `in_review` tant que le personnel prépare ou valide une réponse.

## Règles

- Un étudiant ne peut pas avoir plus de **5 réclamations non résolues** dans un même restaurant.
- Une réclamation de commande (`kind: "order"`) doit viser une commande **de l'étudiant et du même restaurant**.
- Le restaurant, le rôle et l'identité viennent toujours du jeton ou du chemin, jamais du corps de la requête.
- Les erreurs ont la forme habituelle `{ "error": { "code", "message", "details" } }`.

## Étudiant

Rôle `student`, inscrit au restaurant `:slug`.

### `POST /api/restaurants/:slug/claims`

```json
{
  "kind": "order",
  "orderId": "ord_01JAZ8M2Q4",
  "subject": "Boisson manquante",
  "message": "Il manquait une boisson dans ma commande."
}
```

| Champ | Règle |
|---|---|
| `kind` | `order`, `points` ou `other` |
| `orderId` | obligatoire si `kind` vaut `order` |
| `requestedPoints` | obligatoire si `kind` vaut `points` (entier de 1 à 1 000) |
| `subject` | 3 à 100 caractères |
| `message` | 10 à 1 000 caractères |

**Réponse :** `201 Created`, la réclamation vue par l'étudiant.

| Code | Cause |
|---|---|
| `400 VALIDATION_ERROR` | champ manquant ou invalide |
| `403 NOT_A_MEMBER` | l'étudiant n'est pas client de ce restaurant |
| `404 RESTAURANT_NOT_FOUND` | restaurant inconnu ou désactivé |
| `409 TOO_MANY_OPEN_CLAIMS` | déjà 5 réclamations non résolues |
| `422 ORDER_NOT_FOUND` | commande inconnue, d'un autre étudiant ou d'un autre restaurant |

### `GET /api/restaurants/:slug/claims?page=1&pageSize=20`

Réclamations de l'étudiant dans ce restaurant, de la plus récente à la plus ancienne. Réponse : `{ "items": [...], "total": 1, "page": 1, "pageSize": 20 }`.

### `GET /api/claims/:id`

Une réclamation de l'étudiant. `404 CLAIM_NOT_FOUND` si elle appartient à quelqu'un d'autre.

```json
{
  "id": "claim_0f6c",
  "kind": "order",
  "orderId": "ord_01JAZ8M2Q4",
  "orderNumber": "261103-001",
  "subject": "Boisson manquante",
  "message": "Il manquait une boisson dans ma commande.",
  "requestedPoints": null,
  "status": "resolved",
  "decision": "accept",
  "response": "Nous vous offrons une boisson.",
  "createdAt": "2026-11-03T10:00:00.000Z",
  "updatedAt": "2026-11-03T11:00:00.000Z",
  "resolvedAt": "2026-11-03T11:00:00.000Z"
}
```

`decision` et `response` valent `null` tant que `status` n'est pas `resolved`.

## Personnel

Rôles `employee`, `manager`, `admin`, rattachés à un restaurant. Seules les réclamations du restaurant du jeton sont accessibles ; celles d'un autre restaurant répondent `404 CLAIM_NOT_FOUND`.

### `GET /api/staff/claims?status=active&page=1&pageSize=20`

`status` : `active` (par défaut : `open` et `pending_validation`, les plus anciennes d'abord), `open`, `pending_validation` ou `resolved`. Chaque élément ajoute `customer` (`id`, `name`, `phone`), `proposal` (`decision`, `response`, `proposedBy`) et `managerNote`.

### `GET /api/staff/claims/:id`

Une réclamation, avec les champs du personnel.

### `POST /api/staff/claims/:id/propose`

Rôles : `employee`, `manager`, `admin`. Corps : `{ "decision": "accept" | "refuse", "response": "5 à 500 caractères" }`. Possible seulement à l'état `open` (`409 INVALID_CLAIM_STATE` sinon).

### `POST /api/staff/claims/:id/validate`

Rôles : `manager`, `admin`. Corps facultatif : `{ "decision", "response", "grantedPoints" }`. Seul l'administrateur peut fournir `decision` et `response` pour répondre directement ; un gérant valide la proposition existante (`409 NO_PROPOSAL` s'il n'y en a pas). Pour une réclamation de points :

- un gérant reçoit `403 POINTS_CLAIM_ADMIN_ONLY` ;
- `grantedPoints` est compris entre 1 et `requestedPoints` (`400 VALIDATION_ERROR` sinon, par défaut tous les points demandés) ;
- la décision `refuse` n'accorde aucun point.

### `POST /api/staff/claims/:id/reject`

Rôles : `manager`, `admin`. Corps : `{ "note": "3 à 300 caractères" }`. Possible seulement à l'état `pending_validation`.
