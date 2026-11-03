# Contrat d’API — paiements simulés (APP-75)

Ce document définit le démarrage d’un paiement mobile money et la confirmation reçue du fournisseur. Le paiement est simulé pour le moment ; l’adaptateur EasyPay sera ajouté après réception et validation de sa documentation.

## Conventions communes

- Les routes commencent par `/api` et utilisent JSON UTF-8.
- Les montants sont des entiers en francs congolais (FC). Les dates renvoyées sont au format ISO 8601 en UTC.
- Le site ne marque jamais une commande comme payée. L’API confirme les paiements réels à partir d’une notification signée ; en développement et en test, l’étudiant propriétaire peut utiliser la route de simulation protégée.
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

## 1. Démarrer un paiement mobile money

### `POST /api/orders/:id/pay`

**Rôles :** étudiant connecté, propriétaire de la commande.

**En-têtes requis :** `Authorization: Bearer <jeton>` et `Content-Type: application/json`.

**Entrée JSON :**

```json
{
  "operator": "mpesa",
  "phone": "+243812345678"
}
```

`operator` accepte `mpesa`, `orange_money`, `airtel_money` ou `africell_money`. `phone` contient 8 à 15 chiffres, commence par un chiffre différent de zéro et peut être précédé de `+`.

La commande doit appartenir à l’étudiant connecté, utiliser `mobile_money`, être au statut `pending`, avoir un paiement `unpaid` ou `failed` et un total supérieur à zéro. Le serveur crée une nouvelle ligne `payments` au statut `pending` et passe `paymentStatus` de la commande à `pending`. Une commande en espèces ne peut pas démarrer un paiement mobile money. Les paiements échoués restent dans l’historique.

Si un paiement est déjà `pending` pour cette commande, le serveur renvoie le même paiement en `200 OK` sans créer de ligne supplémentaire. Un paiement `pending` expire à la demande après 15 minutes : le prochain démarrage de paiement ou la tentative d’annulation passe le paiement à `failed` et la commande à `paymentStatus: failed`, dans une même transaction. Une nouvelle tentative peut alors créer une ligne de paiement.

Dans la version simulée, `redirectUrl` est un chemin du site, relatif à son origine : `/paiement/simulation/{paymentId}`. Le site affiche la page simulée et ne modifie pas lui-même le statut du paiement.

**Réponses :**

- `201 Created` : paiement démarré.
- `200 OK` : paiement déjà démarré ; la réponse reprend le paiement en attente.

```json
{
  "paymentId": "pay_01JAZ8M2Q4",
  "status": "pending",
  "amountFc": 6000,
  "redirectUrl": "/paiement/simulation/pay_01JAZ8M2Q4"
}
```

**Erreurs :**

| HTTP | Code | Message / cas |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Le corps doit contenir un opérateur et un numéro de téléphone valides. |
| 401 | `UNAUTHORIZED` | Vous devez vous connecter pour continuer ou votre jeton est invalide. |
| 403 | `FORBIDDEN` | Cette action est réservée aux étudiants. |
| 404 | `NOT_FOUND` | Commande introuvable. Une commande d’un autre étudiant reste masquée. |
| 409 | `ORDER_NOT_PAYABLE` | Le paiement ne peut démarrer que pour une commande mobile money en attente, impayée ou avec un paiement échoué. |
| 409 | `PAYMENT_ALREADY_STARTED` | Un paiement est déjà en cours avec d’autres coordonnées. |
| 502 | `PAYMENT_PROVIDER_UNAVAILABLE` | Le service de paiement est momentanément indisponible. |
| 500 | `INTERNAL_ERROR` | Une erreur interne est survenue. |

## 2. Recevoir la confirmation signée du fournisseur

### `POST /api/payments/webhook`

**Accès :** route publique, sans jeton Bearer. L’authenticité est vérifiée au moyen de la signature du corps brut.

**En-têtes requis :** `Content-Type: application/json` et `X-Payment-Signature`, qui contient la représentation hexadécimale du HMAC-SHA-256 du corps HTTP brut. La casse des caractères hexadécimaux est ignorée. Toute modification des octets du corps invalide la signature.

**Entrée JSON :**

```json
{
  "paymentId": "pay_01JAZ8M2Q4",
  "status": "paid",
  "providerRef": "simulation-001",
  "amountFc": 3000
}
```

`status` vaut `paid` ou `failed`. `providerRef` est une référence textuelle non vide fournie avec la notification. `amountFc` est le montant en FC annoncé par le fournisseur : entier strictement positif, facultatif en simulation, **obligatoire pour un fournisseur réel** (voir ci-dessous).

**Traitement :**

- Une notification `paid` valide passe le paiement à `paid`, la commande à `confirmed` avec `paymentStatus: paid`, puis ajoute un événement `confirmed` à son historique.
- Une commande payée en ligne passe automatiquement à `confirmed`.
- Une notification `failed` valide passe le paiement à `failed` et la commande à `paymentStatus: failed`. La commande reste `pending` et peut alors être annulée par l’étudiant.
- Une notification `paid` reçue après l’expiration est acceptée si la commande est encore `pending`. Si la commande a déjà été annulée, son `paymentStatus` passe à `refund_due` pour signaler le remboursement à traiter.
- Le rejeu d’une confirmation identique renvoie `200 OK` sans nouvelle modification ni nouvel événement. Une notification contradictoire après un état final est refusée.

**Réponse :** `200 OK`.

```json
{
  "paymentId": "pay_01JAZ8M2Q4",
  "status": "paid",
  "orderStatus": "confirmed"
}
```

Pour un échec, `status` vaut `failed` et `orderStatus` reste `pending`.

**Erreurs :**

| HTTP | Code | Message / cas |
|---|---|---|
| 400 | `VALIDATION_ERROR` | La notification doit contenir un identifiant, un statut et une référence valides ; `amountFc`, s'il est présent, doit être un entier positif ; il est obligatoire pour un fournisseur réel. |
| 401 | `INVALID_SIGNATURE` | La signature du fournisseur est absente ou invalide. |
| 404 | `PAYMENT_NOT_FOUND` | Paiement introuvable. |
| 409 | `PAYMENT_ALREADY_FINALIZED` | Le paiement a déjà reçu une confirmation différente. |
| 422 | `AMOUNT_MISMATCH` | Le montant reçu ne correspond pas au montant attendu de la commande. |
| 500 | `INTERNAL_ERROR` | Une erreur interne est survenue. |

Le secret de vérification est configuré côté serveur par variable d’environnement et n’est jamais transmis au site. Aucun identifiant marchand ni secret fournisseur n’est requis pour le mode simulé. L’adaptateur EasyPay devra suivre les mécanismes de signature de sa documentation officielle, après validation de cette documentation.

**Vérification du montant.** Quand une notification porte `amountFc`, il est comparé au montant attendu du paiement avant toute modification. En cas de différence, la notification est refusée avec `422 AMOUNT_MISMATCH` : ni le paiement ni la commande ne changent, y compris pour le rejeu d'une confirmation, qu'elle annonce `paid` ou `failed`. Un fournisseur dont les notifications portent un montant (adaptateur qui déclare `requiresAmountVerification`) doit toujours le fournir : sans lui, la notification est refusée en `400`. La notification simulée peut s'en passer. Easypay n'annonce pas de montant : sa notification est confirmée par un appel de vérification de statut, voir [easypay.md](easypay.md).

## Fournisseur réel : Easypay

Le fournisseur se choisit par `PAYMENT_PROVIDER` (`simulation` par défaut, ou `easypay`). Avec `easypay`, `POST /api/orders/:id/pay` initialise la transaction chez Easypay (canal Mobile Money) et renvoie dans `redirectUrl` l'adresse de la page de paiement Easypay ; le site y redirige l'étudiant, qui revient ensuite sur `/orders?commande=…&paiement=succes|annule|erreur`. **Ce retour n'est jamais une preuve de paiement** : seule la confirmation du serveur compte. Une relance de la même demande renvoie la même adresse, sans seconde transaction chez Easypay. L'opérateur et le téléphone saisis sont enregistrés mais non transmis (le parcours avec redirection n'en a pas besoin). Voir [easypay.md](easypay.md).

### `POST /api/payments/easypay/ipn?key=<EASYPAY_IPN_KEY>`

**Accès :** route publique, exposée seulement avec le fournisseur `easypay`. Sans fournisseur réel elle n'existe pas (`404`). La clé de l'adresse écarte les appels étrangers ; elle est comparée en temps constant.

**Corps :** l'objet JSON d'Easypay, lu même sans en-tête `Content-Type` JSON :

```json
{
  "transaction": { "order_ref": "…", "reference": "…" },
  "payment": { "channel": "MOBILE MONEY", "status": "SUCCESS", "reference": "…" }
}
```

La notification n'est ni signée ni accompagnée d'un montant : **son contenu n'est jamais cru**. Seule `transaction.reference` est lue pour retrouver le paiement ; le serveur rappelle ensuite Easypay (`checking-payment`) et applique sa réponse : `SUCCESS` confirme (paiement `paid`, commande `confirmed`), `DECLINED` ou `CANCELED` marquent le paiement `failed` (la commande reste `pending`, nouvelle tentative possible), tout autre état ne change rien.

| HTTP | Code | Cas |
|---|---|---|
| 200 | — | Notification appliquée (ou rejeu sans effet) : `{ "paymentId", "status", "orderStatus" }` |
| 202 | — | Easypay n'a rien confirmé (en attente, transaction inconnue) : rien n'est modifié |
| 400 | `VALIDATION_ERROR` | Corps sans référence de transaction |
| 401 | `INVALID_IPN_KEY` | Clé absente ou invalide ; Easypay n'est pas rappelé |
| 404 | `PAYMENT_NOT_FOUND` | Référence inconnue ; Easypay n'est pas rappelé |
| 409 | `PAYMENT_ALREADY_FINALIZED` | Easypay annonce un état contradictoire après un état final |
| 502 | `PAYMENT_PROVIDER_UNAVAILABLE` | Easypay injoignable ou en erreur ; rien n'est confirmé |

Avec Easypay, la route à signature HMAC (`/api/payments/webhook`) répond toujours `401` et la simulation (`/api/payments/:id/simulate`) `404` : rien d'autre ne peut confirmer un paiement.

## 3. Confirmer un paiement dans la simulation

### `POST /api/payments/:id/simulate`

**Rôles :** étudiant connecté, propriétaire de la commande liée au paiement. Un paiement d’un autre étudiant est masqué avec une réponse `404`.

**Disponibilité :** environnement de développement et de test uniquement. La route répond `404 NOT_FOUND` en production.

**En-têtes requis :** `Authorization: Bearer <jeton>` et `Content-Type: application/json`.

**Entrée JSON :**

```json
{
  "outcome": "paid"
}
```

`outcome` vaut `paid` ou `failed`. Cette route applique le même traitement métier que le webhook, sans signature et sans transmettre ni révéler le secret. Elle génère une référence `simulation-{paymentId}`.

**Réponse :** `200 OK`, avec le même format que la confirmation du webhook.

```json
{
  "paymentId": "pay_01JAZ8M2Q4",
  "status": "paid",
  "orderStatus": "confirmed"
}
```

**Erreurs :**

| HTTP | Code | Message / cas |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Le corps doit indiquer le résultat du paiement simulé, `paid` ou `failed`. |
| 401 | `UNAUTHORIZED` | Vous devez vous connecter pour continuer ou votre jeton est invalide. |
| 403 | `FORBIDDEN` | Cette action est réservée aux étudiants. |
| 404 | `NOT_FOUND` | Route introuvable en production. |
| 404 | `PAYMENT_NOT_FOUND` | Paiement introuvable ou appartenant à un autre étudiant. |
| 409 | `PAYMENT_ALREADY_FINALIZED` | Le paiement a déjà reçu une confirmation différente ou sa commande ne peut plus être modifiée. |
| 500 | `INTERNAL_ERROR` | Une erreur interne est survenue. |

## Scénarios couverts par les tests

1. Démarrer un paiement mobile money appartenant à l’étudiant : ligne `payments` et `paymentStatus` à `pending`.
2. Réutiliser une demande en attente sans créer de deuxième paiement.
3. Refuser une commande étrangère sans révéler son existence, une commande en espèces ou une commande qui n’est plus `pending` ou dont le paiement n’est ni `unpaid` ni `failed` ; refuser aussi un changement de coordonnées lorsqu’un paiement est déjà en attente.
4. Refuser une signature absente ou invalide ; accepter une notification authentique calculée sur les octets exacts du corps.
5. Confirmer un paiement une fois, passer la commande à `confirmed` et ajouter un seul événement.
6. Rejouer la même notification sans effet ; refuser une notification contradictoire après finalisation.
7. Après un échec, laisser la commande `pending`, avec le paiement `failed`, autoriser une nouvelle tentative et préserver l’historique des paiements.
8. Expirer à la demande un paiement après 15 minutes au démarrage d’un nouveau paiement ou d’une annulation ; accepter une confirmation tardive si la commande attend encore, et utiliser `refund_due` si elle a été annulée.
9. Confirmer un paiement réussi ou échoué par la route de simulation pour le propriétaire, refuser un autre étudiant, vérifier le rejeu et l’isolation entre restaurants, et confirmer le `404` en production.
10. Isoler les mises à jour par restaurant et refuser l’annulation d’une commande payée.
11. Vérifier le montant des notifications : conforme confirmé ; différent (inférieur ou supérieur) refusé en `422 AMOUNT_MISMATCH` sans modifier le paiement ni la commande, même en rejeu ; montant invalide refusé en `400` ; absent accepté en simulation et refusé pour un fournisseur réel.
12. Easypay (sans réseau réel, faux client HTTP) : initialisation et rejeu de la redirection depuis la référence, confirmation sur `SUCCESS`, échec sur `DECLINED` et `CANCELED`, notification démentie par Easypay sans effet, statut du corps ignoré, Easypay injoignable en `502`, clé fausse en `401`, référence inconnue en `404`, rejeu et contradiction, routes HMAC et simulation fermées.
