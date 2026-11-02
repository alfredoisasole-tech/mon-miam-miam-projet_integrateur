# Contrat d'API — points de fidélité (APP-25)

Ce document définit la consultation du solde de fidélité d'un étudiant. Les règles de gain et d'utilisation sont décrites dans [regles-commande-paiement.md](../regles-commande-paiement.md) (§5) et [regles-multi-restaurants.md](../regles-multi-restaurants.md) (§5) ; l'utilisation des points à la commande est décrite dans [commandes.md](commandes.md) (`redeemMeal`).

## Règles rappelées

- Les points sont **propres à chaque restaurant** : le solde est associé au couple étudiant-restaurant, jamais partagé entre restaurants.
- **Gain** : 3 000 FC dépensés sur les plats (hors livraison, après remise) = 1 point ; le reste est reporté. Les points sont crédités quand la commande passe à `completed`. Une commande annulée ne rapporte rien.
- **Utilisation** : 15 points = 3 000 FC de remise sur les plats, jamais sur la livraison. Un seul lot de 15 points par commande.
- **Validité** : les points expirent 12 mois après leur gain ; les lots qui expirent le plus tôt sont utilisés en premier.
- **Annulation** : les points utilisés sur une commande annulée sont rendus, une seule fois.
- Le serveur est la seule source de vérité : le navigateur ne transmet aucun solde, remise ni nombre de points.

## 1. Consulter son solde

### `GET /api/restaurants/:slug/loyalty`

**Rôles :** `student` connecté et inscrit au restaurant `:slug`. Le serveur déduit l'étudiant du jeton Bearer ; aucun identifiant d'étudiant n'est accepté.

**Entrée :** le `slug` du restaurant dans le chemin ; aucun corps.

**Réponse :** `200 OK`.

```json
{
  "restaurant": { "slug": "zeduc-space", "name": "ZeDuc@Space" },
  "availablePoints": 17,
  "remainderFc": 1000,
  "canRedeem": true,
  "rules": {
    "spendPerPointFc": 3000,
    "pointsForReward": 15,
    "rewardValueFc": 3000,
    "validityMonths": 12
  },
  "movements": [
    {
      "kind": "redeem",
      "points": -15,
      "orderId": "ord_01JAZ8M2Q4",
      "orderNumber": "261026-004",
      "createdAt": "2026-10-26T08:00:00.000Z",
      "expiresAt": null
    },
    {
      "kind": "earn",
      "points": 32,
      "orderId": "ord_01JAZ7K9X1",
      "orderNumber": "261020-012",
      "createdAt": "2026-10-20T12:30:00.000Z",
      "expiresAt": "2027-10-20T12:30:00.000Z"
    }
  ]
}
```

| Champ | Description |
|---|---|
| `availablePoints` | Points utilisables maintenant dans ce restaurant (points expirés exclus). Même calcul que celui qui contrôle `redeemMeal` à la commande. |
| `remainderFc` | Dépense déjà comptée mais pas encore transformée en point (toujours inférieure à `spendPerPointFc`). |
| `canRedeem` | `true` si `availablePoints` atteint `rules.pointsForReward`. Indicatif : le serveur revérifie à la commande. |
| `rules` | Règles du restaurant : dépense par point (FC), points pour une remise, valeur de la remise (FC), validité (mois). |
| `movements` | Les 50 mouvements les plus récents, du plus récent au plus ancien. |

Valeurs de `movements[].kind` : `earn` (gain), `referral` (parrainage), `redeem` (utilisation, points négatifs), `expire`, `adjust`, `refund`. `orderId` et `orderNumber` valent `null` quand le mouvement n'est pas lié à une commande ; `expiresAt` n'est renseigné que pour les points gagnés (`earn`, `referral`). Le détail interne des lots débités n'est jamais exposé.

Le solde porte sur **tous** les points du restaurant, pas seulement sur les 50 mouvements affichés. Quand une commande est annulée, les points sont rendus à leurs lots d'origine : le solde remonte, sans nouvelle ligne de gain.

**Erreurs :**

| HTTP | Code | Cas |
|---|---|---|
| 401 | `UNAUTHORIZED` | Jeton absent ou invalide. |
| 403 | `FORBIDDEN` | Rôle autre que `student`, ou étudiant non inscrit à ce restaurant. |
| 404 | `NOT_FOUND` | Restaurant inconnu. |
| 500 | `INTERNAL_ERROR` | Erreur inattendue. |

**Scénarios couverts par les tests :** solde vide avec les règles, points expirés ignorés, reste de dépense reporté, isolation par restaurant et par étudiant, ordre et limite de 50 de l'historique sans données internes, 401, 403 (hors rôle et sans adhésion), 404.

## 2. Utiliser ses points et sécurité du solde

L'utilisation se fait à la création de la commande avec `redeemMeal: true` ([commandes.md](commandes.md), `POST /api/orders`). Garanties vérifiées par les tests :

1. Si le solde du restaurant est inférieur à 15 points, la commande est refusée avec `422 INSUFFICIENT_POINTS`, sans commande créée ni point retiré. Des points d'un autre restaurant, d'un autre étudiant ou expirés ne comptent pas.
2. Les mêmes points ne peuvent pas servir deux fois : deux demandes simultanées sur les mêmes 15 points donnent une commande créée et un refus `422`.
3. Rejouer une requête avec la même clé `Idempotency-Key` ne débite qu'une fois ; la même clé avec un autre contenu donne `409 IDEMPOTENCY_KEY_REUSED`.
4. Les montants, la remise et les points envoyés par le navigateur sont ignorés ; le serveur recalcule tout.
5. Chaque utilisation est enregistrée dans le journal des points (`kind = redeem`, points négatifs, commande concernée).
6. Les points d'une commande annulée sont rendus une seule fois, que l'annulation vienne de l'étudiant ou du personnel, même si elle est répétée.
7. Les points ne sont crédités qu'une fois par commande, même si deux fins de commande arrivent en même temps.
