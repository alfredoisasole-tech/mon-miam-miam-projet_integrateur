# Contrat d'API — Restaurants (APP-19)

> Story Jira : APP-19 « Sélectionner un restaurant »
> Sous-tâches : 11.1 (liste), 11.2 (menu et promotions), 11.3 (changement de restaurant)
> Dernière mise à jour : 27 octobre 2026

## Règles transversales

- **Un restaurant désactivé répond 404** sur toutes les routes publiques (comme s'il n'existait pas).
- **Le panier est propre à chaque restaurant** côté site : changer de restaurant vide le panier (avec confirmation).
- **Les montants sont en entiers de francs congolais (FC)**, jamais de décimales.
- **Les couleurs du restaurant** (primaire `#cfbd97`, secondaire `#000000` par défaut) sont renvoyées pour personnalisation côté client.

---

## 1. Liste publique des restaurants

### `GET /api/restaurants`

**Rôles autorisés** : public.

**Paramètres d'URL** :

| Paramètre | Règle |
|---|---|
| `page` | facultatif, défaut 1 |
| `pageSize` | facultatif, défaut 20, max 100 |

**Sortie (200)** :

```json
{
  "items": [
    {
      "slug": "zeduc-space",
      "name": "ZeDuc@Space",
      "slogan": "Le goût de la terrasse",
      "logoUrl": "https://.../zeduc-logo.png",
      "colors": {
        "primary": "#cfbd97",
        "secondary": "#000000"
      },
      "isOpenNow": true
    },
    {
      "slug": "chez-lea",
      "name": "Chez Léa",
      "slogan": "Cuisine familiale",
      "logoUrl": "https://.../lea-logo.png",
      "colors": {
        "primary": "#cfbd97",
        "secondary": "#000000"
      },
      "isOpenNow": false
    }
  ],
  "total": 2,
  "page": 1,
  "pageSize": 20
}
```

**Règles** :

- Seuls les restaurants **actifs** (`status = 'active'`) sont renvoyés.
- Triés par **nom** (ordre alphabétique, insensible à la casse).
- `isOpenNow` est calculé à partir des heures d'ouverture du restaurant et de l'heure actuelle (UTC+1, Kinshasa).

**Erreurs** : aucune (liste vide si aucun restaurant actif → `items: []`).

---

## 2. Profil public d'un restaurant

### `GET /api/restaurants/:slug`

**Rôles autorisés** : public.

**Sortie (200)** :

```json
{
  "slug": "zeduc-space",
  "name": "ZeDuc@Space",
  "slogan": "Le goût de la terrasse",
  "description": "Restaurant préféré des étudiants de l'UCAC-ICAM...",
  "logoUrl": "https://.../zeduc-logo.png",
  "coverUrl": "https://.../zeduc-cover.png",
  "colors": {
    "primary": "#cfbd97",
    "secondary": "#000000"
  },
  "address": {
    "commune": "Yansoki",
    "quartier": "Terrasse",
    "repere": "Sommet de la résidence la Terrasse"
  },
  "openingHours": {
    "monday": { "open": "10:00", "close": "22:00" },
    "tuesday": { "open": "10:00", "close": "22:00" }
  },
  "isOpenNow": true,
  "loyalty": {
    "spendPerPointFc": 3000,
    "pointsForReward": 15,
    "rewardValueFc": 3000,
    "validityMonths": 12
  }
}
```

**Erreurs** :

| Statut | Code | Message |
|---|---|---|
| 404 | `RESTAURANT_NOT_FOUND` | « Restaurant introuvable ou désactivé » |

---

## 3. Menu d'un restaurant

### `GET /api/restaurants/:slug/menu`

**Rôles autorisés** : public.

**Sortie (200)** :

```json
{
  "restaurant": "zeduc-space",
  "categories": [
    {
      "name": "Plats",
      "items": [
        {
          "id": "itm_abc123",
          "name": "Poulet braisé",
          "description": "Poulet braisé avec plantains",
          "priceFc": 4500,
          "isDaily": false,
          "isAvailable": true,
          "imageUrl": "https://.../poulet.png"
        }
      ]
    },
    {
      "name": "Boissons",
      "items": []
    }
  ],
  "dailyItems": [
    {
      "id": "itm_xyz789",
      "name": "Pondu-mbika",
      "description": "Plat du jour",
      "priceFc": 3500,
      "isDaily": true,
      "isAvailable": true,
      "imageUrl": "https://.../pondu.png"
    }
  ]
}
```

**Règles** :

- Seuls les plats **disponibles** (`isAvailable = true`) et du restaurant `:slug` sont renvoyés.
- Les **plats du jour** (`isDaily = true`) sont renvoyés séparément dans `dailyItems`, en tête du menu.
- Les catégories **vides** (aucun plat disponible) ne sont **pas affichées**.
- Un plat épuisé n'apparaît pas du tout.

**Erreurs** :

| Statut | Code | Message |
|---|---|---|
| 404 | `RESTAURANT_NOT_FOUND` | « Restaurant introuvable ou désactivé » |

---

## 4. Promotions d'un restaurant

### `GET /api/restaurants/:slug/promotions`

**Rôles autorisés** : public.

Le contrat détaillé, le format de réponse, les règles de période et les erreurs sont définis dans [Contrat d’API — promotions (APP-18)](./promotions.md).

---

## 5. Comportement du site (côté front, pas d'endpoint serveur)

Ces règles sont implémentées côté React, pas côté API :

1. **Mémorisation du restaurant choisi** : le slug est stocké dans `localStorage` via `RestaurantProvider` (fichier `frontend/src/controllers/session.tsx`).
2. **Panier propre à chaque restaurant** : le panier stocke `{ slug, items }`. Si l'utilisateur change de restaurant, le panier est **vidé** après confirmation.
3. **Changement de restaurant** : si l'utilisateur a des articles dans son panier et clique sur un autre restaurant, une modale de confirmation apparaît : « Vous avez des articles dans votre panier actuel. Voulez-vous changer de restaurant ? Votre panier sera vidé. »
4. **Personnalisation visuelle** : les couleurs du restaurant sont posées en variables CSS (`--mm-color-primary`, `--mm-color-secondary`) via `theme.tsx`.

---

## Tests à écrire en premier (TDD)

Avant d'écrire le code, écrire ces tests dans `backend/tests/api/restaurants.test.ts` :

1. **Liste vide** (aucun restaurant) → 200, `items: []`.
2. **Liste avec restaurants désactivés** → seuls les actifs sont renvoyés, triés par nom.
3. **Profil d'un slug inconnu** → 404 `RESTAURANT_NOT_FOUND`.
4. **Profil d'un slug désactivé** → 404 `RESTAURANT_NOT_FOUND` (même réponse).
5. **Menu avec plats d'un autre restaurant** → ces plats n'apparaissent pas.
6. **Menu avec plats épuisés** → ces plats n'apparaissent pas.
7. **Menu avec catégories vides** → ces catégories ne sont pas renvoyées.
8. **Promotions hors dates** → ne sont pas renvoyées.
9. **Promotions désactivées** → ne sont pas renvoyées.