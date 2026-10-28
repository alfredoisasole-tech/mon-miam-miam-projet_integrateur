# Contrat d’API — promotions (APP-18)

Ce document définit le contrat de consultation des promotions. Il formalise les sous-tâches APP-58 (afficher les promotions actives), APP-59 (gérer leur période de validité) et APP-60 (filtrer par restaurant). Il s’agit du contrat ; il ne met pas en œuvre la route.

## 1. Consulter les promotions d’un restaurant

### `GET /api/restaurants/:slug/promotions`

Retourne les promotions actuellement visibles du restaurant désigné par son slug.

**Entrée :** aucun corps et aucun paramètre de requête. Le restaurant est indiqué par `slug` dans le chemin.

Une promotion est retournée si toutes les conditions suivantes sont remplies :

- elle appartient au restaurant correspondant au slug demandé ;
- le restaurant a le statut `active` ;
- `is_active` vaut `1` ;
- l’instant courant en UTC est supérieur ou égal à `starts_at` et strictement inférieur à `ends_at`.

Les bornes forment donc l’intervalle `[starts_at, ends_at)`. Les dates stockées et échangées sont au format ISO 8601 UTC. Les promotions sont triées par date de début croissante, puis par identifiant croissant pour stabiliser l’ordre.

### Réponse `200 OK`

Une liste vide est renvoyée si le restaurant existe et est actif, mais qu’aucune promotion ne satisfait les conditions de visibilité.

```json
{
  "items": [
    {
      "id": "promo-uuid",
      "kind": "promotion",
      "title": "Offre du jour",
      "description": null,
      "imageAssetId": "asset-uuid",
      "startsAt": "2026-10-28T08:00:00.000Z",
      "endsAt": "2026-10-29T08:00:00.000Z",
      "active": true
    }
  ]
}
```

| Champ | Type | Détail |
|---|---|---|
| `id` | chaîne | Identifiant de `promotions.id`. |
| `kind` | chaîne | Valeur de `promotions.kind` : `promotion`, `event` ou `game`. |
| `title` | chaîne | Titre de la promotion. |
| `description` | chaîne ou `null` | Description facultative. |
| `imageAssetId` | chaîne ou `null` | Référence à `assets.id`, issue de `image_asset_id`. Ce champ n’est pas une URL. |
| `startsAt` | chaîne | Début de validité, au format ISO 8601 UTC. |
| `endsAt` | chaîne | Fin de validité, au format ISO 8601 UTC. |
| `active` | booléen | Vaut `true` pour chaque élément retourné. |

La réponse n’inclut pas d’URL d’image : le modèle ne définit que la référence `image_asset_id`, et la route de consultation d’un asset n’est pas spécifiée ici. Aucun montant ni type de réduction n’est exposé, car ces champs ne figurent pas dans le modèle actuel des promotions.

### Erreurs

Les erreurs suivent la forme commune de l’API :

```json
{
  "error": {
    "code": "RESTAURANT_NOT_FOUND",
    "message": "Restaurant introuvable.",
    "details": []
  }
}
```

| Statut | Code | Cas |
|---|---|---|
| `404` | `RESTAURANT_NOT_FOUND` | Slug inconnu ou restaurant inactif. |
| `500` | `INTERNAL_ERROR` | Erreur inattendue, sans détail technique dans la réponse. |

## 2. Vérifications attendues

- Retourner une promotion active dont la période inclut l’instant courant.
- Exclure les promotions désactivées, futures et expirées.
- Inclure une promotion exactement à `starts_at` et exclure une promotion exactement à `ends_at`.
- Ne retourner que les promotions du restaurant demandé, même si d’autres restaurants ont des promotions actives.
- Retourner `200` avec `items: []` quand aucune promotion n’est disponible.
- Retourner `404 RESTAURANT_NOT_FOUND` pour un slug inconnu ou un restaurant inactif.
- Respecter l’ordre stable défini par `starts_at`, puis `id`.
- Préserver les valeurs nulles de `description` et `image_asset_id`.

## 3. Limites du modèle actuel

Le modèle documente les catégories `promotion`, `event` et `game`, mais ne définit ni montant/type de réduction ni données de participation ou de récompense. Ces besoins doivent être confirmés dans le modèle avant d’être ajoutés au contrat. De même, `image_asset_id` permet d’identifier un asset, mais aucun chemin de lecture d’image n’est défini dans ce contrat.

Le caractère public ou authentifié de cette route n’est pas précisé dans les éléments disponibles pour APP-18 ; il doit être confirmé et aligné sur les règles d’accès communes avant l’implémentation.
