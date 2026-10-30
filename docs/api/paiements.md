# Contrat d’API — paiements simulés (APP-75)

Ce document définit le démarrage d’un paiement mobile money et la confirmation reçue du fournisseur. Le paiement est simulé pour le moment ; l’adaptateur EasyPay sera ajouté après réception et validation de sa documentation.

## Conventions communes

- Les routes commencent par `/api` et utilisent JSON UTF-8.
- Les montants sont des entiers en francs congolais (FC). Les dates renvoyées sont au format ISO 8601 en UTC.
- Le site ne marque jamais une commande comme payée. Seule une notification signée et vérifiée par l’API peut confirmer un paiement.
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

La commande doit appartenir à l’étudiant connecté, utiliser `mobile_money`, être au statut `pending`, avoir un paiement `unpaid` et un total supérieur à zéro. Le serveur crée une ligne `payments` au statut `pending` et passe `paymentStatus` de la commande à `pending`. Une commande en espèces ne peut pas démarrer un paiement mobile money.

Si un paiement est déjà `pending` pour cette commande, le serveur renvoie le même paiement en `200 OK` sans créer de ligne supplémentaire. Dans la version simulée, `redirectUrl` est un chemin du site, relatif à son origine : `/paiement/simulation/{paymentId}`. Le site affiche la page simulée et ne modifie pas lui-même le statut du paiement.

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
| 409 | `ORDER_NOT_PAYABLE` | Le paiement ne peut démarrer que pour une commande mobile money en attente et non payée. |
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
  "providerRef": "simulation-001"
}
```

`status` vaut `paid` ou `failed`. `providerRef` est une référence textuelle non vide fournie avec la notification.

**Traitement :**

- Une notification `paid` valide passe le paiement à `paid`, la commande à `confirmed` avec `paymentStatus: paid`, puis ajoute un événement `confirmed` à son historique.
- Une notification `failed` valide passe le paiement à `failed` et la commande à `paymentStatus: failed`. La commande reste `pending` et peut alors être annulée par l’étudiant.
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
| 400 | `VALIDATION_ERROR` | La notification doit contenir un identifiant, un statut et une référence valides. |
| 401 | `INVALID_SIGNATURE` | La signature du fournisseur est absente ou invalide. |
| 404 | `PAYMENT_NOT_FOUND` | Paiement introuvable. |
| 409 | `PAYMENT_ALREADY_FINALIZED` | Le paiement a déjà reçu une confirmation différente. |
| 500 | `INTERNAL_ERROR` | Une erreur interne est survenue. |

Le secret de vérification est configuré côté serveur par variable d’environnement et n’est jamais transmis au site. Aucun identifiant marchand ni secret fournisseur n’est requis pour le mode simulé. L’adaptateur EasyPay devra suivre les mécanismes de signature de sa documentation officielle, après validation de cette documentation.

## Scénarios couverts par les tests

1. Démarrer un paiement mobile money appartenant à l’étudiant : ligne `payments` et `paymentStatus` à `pending`.
2. Réutiliser une demande en attente sans créer de deuxième paiement.
3. Refuser une commande étrangère sans révéler son existence, une commande en espèces ou une commande qui n’est plus `pending` et `unpaid` ; refuser aussi un changement de coordonnées lorsqu’un paiement est déjà en attente.
4. Refuser une signature absente ou invalide ; accepter une notification authentique calculée sur les octets exacts du corps.
5. Confirmer un paiement une fois, passer la commande à `confirmed` et ajouter un seul événement.
6. Rejouer la même notification sans effet ; refuser une notification contradictoire après finalisation.
7. Après un échec, laisser la commande `pending`, avec le paiement `failed`, et autoriser son annulation.
8. Isoler les mises à jour par restaurant et refuser l’annulation d’une commande payée.
