# API des statistiques du restaurant (L-11)

Les données sont recalculées depuis SQLite à chaque requête. Le restaurant est toujours déterminé par le jeton du personnel; l’API n’accepte aucun identifiant ou slug de restaurant fourni par le client.

## Bilan du restaurant

### `GET /api/staff/stats/overview?period=day|week|month`

**Rôles** : `manager`, `admin` du restaurant associé au jeton.

`period` est facultatif et vaut `day` par défaut. Les bornes calendaires sont calculées dans le fuseau `Africa/Kinshasa`, avec une semaine qui commence le lundi. Les intervalles sont semi-ouverts : début inclus, fin exclue.

La période des compteurs de commandes et des plats vendus est fondée sur la date de création des commandes et, pour les ventes/plats, sur leur date de fin. Seules les commandes `completed` contribuent aux ventes, au panier moyen et au classement des plats. Les montants sont des nombres entiers en FC. Le panier moyen est arrondi vers le bas au FC.

**Réponse (200)** :

```json
{
  "period": "day",
  "from": "2026-11-02T23:00:00.000Z",
  "to": "2026-11-03T08:30:00.000Z",
  "orders": {
    "total": 3,
    "completed": 1,
    "active": 1,
    "cancelled": 1,
    "byStatus": {
      "pending": 1,
      "confirmed": 0,
      "preparing": 0,
      "ready": 0,
      "out_for_delivery": 0,
      "completed": 1,
      "cancelled": 1
    }
  },
  "salesFc": 4000,
  "averageOrderFc": 4000,
  "topItems": [
    { "name": "Poulet mayonnaise", "quantity": 2, "revenueFc": 5000 }
  ]
}
```

`total`, `completed`, `active` et `cancelled` correspondent aux commandes créées dans la période, regroupées selon leur état actuel. `active` regroupe `pending`, `confirmed`, `preparing`, `ready` et `out_for_delivery`. `topItems` est classé par quantité vendue décroissante, puis par revenu décroissant. `revenueFc` additionne les lignes avant remise globale de la commande.

## Ventes de la semaine

### `GET /api/staff/stats/weekly`

**Rôles** : `employee`, `manager`, `admin` du restaurant associé au jeton.

La réponse couvre la semaine locale courante, du lundi au dimanche. Elle contient toujours sept entrées; les jours futurs et les jours sans vente ont des valeurs à zéro.

**Réponse (200)** :

```json
{
  "from": "2026-11-01T23:00:00.000Z",
  "to": "2026-11-08T23:00:00.000Z",
  "totalSalesFc": 6000,
  "ordersCompleted": 2,
  "days": [
    { "date": "2026-11-02", "label": "lundi", "salesFc": 2000, "orders": 1 },
    { "date": "2026-11-03", "label": "mardi", "salesFc": 4000, "orders": 1 },
    { "date": "2026-11-04", "label": "mercredi", "salesFc": 0, "orders": 0 },
    { "date": "2026-11-05", "label": "jeudi", "salesFc": 0, "orders": 0 },
    { "date": "2026-11-06", "label": "vendredi", "salesFc": 0, "orders": 0 },
    { "date": "2026-11-07", "label": "samedi", "salesFc": 0, "orders": 0 },
    { "date": "2026-11-08", "label": "dimanche", "salesFc": 0, "orders": 0 }
  ]
}
```

Les ventes journalières sont regroupées selon l’heure de fin de commande convertie en `Africa/Kinshasa`. Les ventes sont les totaux encaissés des commandes terminées.

## Erreurs et accès

Les erreurs respectent le format commun `{ "error": { "code", "message", "details" } }`.

- `401 UNAUTHORIZED` : jeton absent ou invalide.
- `403 FORBIDDEN` : rôle non autorisé ou compte sans restaurant associé.
- `400 VALIDATION_ERROR` : période inconnue ou répétée.
