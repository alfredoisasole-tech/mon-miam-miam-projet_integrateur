# Contrat d'API — parrainage, avis, classement et compte

Ce document décrit les fonctions de la vie étudiante qui ne sont pas des commandes : suivi du parrainage, avis après livraison, classement des meilleurs clients, données personnelles et mot de passe. Les erreurs ont la forme habituelle `{ "error": { "code", "message", "details" } }`.

## 1. Parrainage

Le code de parrainage est **unique et global** : il fonctionne à l'inscription dans n'importe quel restaurant. La récompense (1 point par tranche de 3 000 FC de la première commande qualifiante du filleul) est créditée au parrain dans le restaurant de cette commande. Les règles de calcul sont dans [fidelite.md](fidelite.md).

### À l'inscription

`POST /api/auth/register` accepte `referralCode` (facultatif, majuscules ou minuscules). Un code inconnu est refusé : `422 INVALID_REFERRAL_CODE`, aucun compte n'est créé.

### `GET /api/restaurants/:slug/referral`

Rôle `student`, client du restaurant `:slug`. Renvoie le code de l'étudiant (créé à la demande pour un ancien compte) et l'état de ses filleuls. Les noms sont **partiellement masqués** (« Marie K. ») ; aucun e-mail ni téléphone n'est renvoyé.

```json
{
  "code": "A1B2C3D4E5F6",
  "restaurant": { "slug": "zeduc-space", "name": "ZeDuc@Space" },
  "referees": [
    { "name": "Alice M.", "status": "pending", "rewardPoints": null, "rewardedAt": null, "rewardRestaurant": null, "joinedAt": "2026-11-01T09:00:00.000Z" },
    { "name": "Bob I.", "status": "rewarded", "rewardPoints": 2, "rewardedAt": "2026-11-04T10:00:00.000Z",
      "rewardRestaurant": { "slug": "zeduc-space", "name": "ZeDuc@Space" }, "joinedAt": "2026-11-02T09:00:00.000Z" }
  ],
  "totals": { "referees": 2, "rewarded": 1, "pointsEarned": 2 }
}
```

`pointsEarned` compte les points de parrainage gagnés dans ce restaurant.

## 2. Avis après livraison

### `POST /api/orders/:id/review`

Rôle `student`, propriétaire de la commande. Corps : `{ "rating": 1 à 5, "comment": "facultatif, 500 caractères maximum" }`. Réponse `201` : `{ "orderId", "rating", "comment", "commentedAt" }`.

| Code | Cause |
|---|---|
| `400 VALIDATION_ERROR` | note absente, non entière ou hors de 1 à 5 ; commentaire trop long |
| `404 NOT_FOUND` | commande inconnue ou d'un autre étudiant |
| `409 ORDER_NOT_COMPLETED` | la commande n'est pas terminée |
| `409 ALREADY_REVIEWED` | un avis existe déjà (un seul avis par commande) |

La note et le commentaire apparaissent ensuite dans `GET /api/orders/:id`.

## 3. Classement des meilleurs clients

### `GET /api/restaurants/:slug/top-clients?period=month`

Rôle `student`, client du restaurant. `period` : `day`, `week` ou `month` (par défaut). Le classement porte sur le **nombre de commandes terminées** du restaurant sur la période ; à égalité, la dépense (plats après remise, sans livraison) départage. Les périodes commencent à minuit **heure de Kinshasa** (UTC+1) ; la semaine commence le lundi. Les comptes supprimés ou désactivés n'y figurent pas. Dix lignes au maximum, noms masqués.

```json
{
  "period": "week",
  "from": "2026-11-01T23:00:00.000Z",
  "restaurant": { "slug": "zeduc-space", "name": "ZeDuc@Space" },
  "items": [
    { "rank": 1, "name": "Bob I.", "orders": 2, "spentFc": 12000, "isMe": true }
  ]
}
```

## 4. Données personnelles

### `GET /api/me/export`

Rôle `student`. Télécharge un fichier JSON (`Content-Disposition: attachment; filename="mes-donnees.json"`) avec le compte, les restaurants, les commandes et leurs articles, les mouvements de points, les réclamations et les filleuls (noms masqués). Le mot de passe n'en fait jamais partie.

### `DELETE /api/me`

Rôle `student`. Corps : `{ "password": "mot de passe actuel" }`. Le compte est **anonymisé** : nom, e-mail, téléphone, adresse et textes personnels sont effacés, l'e-mail et le téléphone sont libérés, les points restants sont abandonnés, les jetons déjà émis cessent de fonctionner. Les montants et les dates des commandes restent pour la comptabilité des restaurants. Réponse `200` : `{ "deleted": true }`.

| Code | Cause |
|---|---|
| `401 INVALID_CREDENTIALS` | mot de passe incorrect |
| `403 FORBIDDEN` | le compte n'est pas un compte étudiant (le personnel est géré par son administrateur) |
| `409 ORDER_IN_PROGRESS` | une commande n'est pas encore terminée ou annulée |

## 5. Mot de passe

### `POST /api/auth/change-password`

Toute personne connectée. Corps : `{ "currentPassword", "newPassword" }`. Réponse `200` : `{ "token", "user" }` avec un **nouveau jeton** ; les anciens jetons deviennent invalides. Pour un compte du personnel créé avec un mot de passe temporaire, `mustChangePassword` passe à `false`.

| Code | Cause |
|---|---|
| `401 INVALID_CREDENTIALS` | mot de passe actuel incorrect |
| `422 WEAK_PASSWORD` | le nouveau mot de passe n'a pas 8 caractères, une majuscule et un chiffre |
| `422 SAME_PASSWORD` | le nouveau mot de passe est identique à l'actuel |
| `429 TOO_MANY_ATTEMPTS` | trop d'essais en 15 minutes |

### Mot de passe oublié

`POST /api/auth/forgot-password` puis `POST /api/auth/reset-password` : voir [auth.md](auth.md). Tant qu'aucun service d'envoi (SMS ou e-mail) n'est branché, le code est écrit dans les **journaux du serveur** hors production ; en production la route répond `503 RESET_DELIVERY_UNAVAILABLE`. Le choix du fournisseur d'envoi reste à faire.
