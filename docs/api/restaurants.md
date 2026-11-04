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
      "fontFamily": "Poppins",
      "defaultMode": "light",
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
      "fontFamily": "Poppins",
      "defaultMode": "light",
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
- `colors`, `fontFamily`, `defaultMode` (`light`, `dark` ou `system`) et `logoUrl` forment la **charte graphique du restaurant** : le site les applique à toutes ses pages. Ils se modifient par l'administrateur, sans redéploiement : voir [parametres.md](parametres.md).

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
  "logoUrl": "/api/restaurants/zeduc-space/assets/img_logo1",
  "colors": {
    "primary": "#cfbd97",
    "secondary": "#000000"
  },
      "fontFamily": "Poppins",
      "defaultMode": "light",
  "isOpenNow": true,
  "openingHours": {
    "mon": [{ "open": "10:00", "close": "22:00" }],
    "thu": [{ "open": "10:00", "close": "14:00" }, { "open": "18:00", "close": "22:00" }]
  },
  "delivery": {
    "enabled": true,
    "feeFc": 1000,
    "communes": ["Yansoki"]
  },
  "loyalty": {
    "spendPerPointFc": 3000,
    "pointsForReward": 15,
    "rewardValueFc": 3000,
    "validityMonths": 12
  }
}
```

**Règles** :

- `openingHours` : clés `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun` ; chaque jour contient une **liste de créneaux** (plusieurs par jour possibles). Un jour absent = fermé. Les heures sont celles du fuseau du restaurant (Kinshasa par défaut).
- `description`, `coverUrl` et `address` ne sont **pas encore** fournis : le schéma de la base n'a pas ces colonnes. Ils seront ajoutés avec une nouvelle migration si l'équipe les décide.

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

### `GET /api/restaurants/:slug/assets/:id`

**Rôles autorisés** : public. Sert une image (logo ou plat) **du restaurant `:slug` uniquement**.

- Formats servis : `image/png`, `image/jpeg`, `image/webp`. Tout autre format (SVG compris) répond 404.
- Image d'un autre restaurant, inconnue ou restaurant désactivé : 404 (`ASSET_NOT_FOUND` ou `RESTAURANT_NOT_FOUND`).
- Les champs `logoUrl` et `imageUrl` des autres réponses pointent vers cette route (chemin relatif).

---

## 4. Promotions d'un restaurant

### `GET /api/restaurants/:slug/promotions`

**Rôles autorisés** : public.

**Sortie (200)** :

```json
{
  "restaurant": "zeduc-space",
  "items": [
    {
      "id": "promo_001",
      "type": "promotion",
      "title": "Happy Hour",
      "description": "-20% sur les boissons de 14h à 17h",
      "imageUrl": "https://.../happy-hour.png",
      "startDate": "2026-10-27T00:00:00Z",
      "endDate": "2026-11-03T23:59:59Z"
    }
  ]
}
```

**Règles** :

- Seules les affiches **actives** (`status = 'active'`) et **dans leurs dates** (`startDate ≤ now ≤ endDate`) sont renvoyées.
- Types possibles : `promotion`, `event`, `game`.

**Erreurs** :

| Statut | Code | Message |
|---|---|---|
| 404 | `RESTAURANT_NOT_FOUND` | « Restaurant introuvable ou désactivé » |

---

## 5. Comportement du site (côté front, pas d'endpoint serveur)

Ces règles sont implémentées côté React, pas côté API :

1. **Mémorisation du restaurant choisi** : le slug est stocké dans `localStorage` via `RestaurantProvider` (fichier `frontend/src/controllers/session.tsx`).
2. **Panier propre à chaque restaurant** : le panier stocke `{ slug, items }`. Si l'utilisateur change de restaurant, le panier est **vidé** après confirmation.
3. **Changement de restaurant** : si l'utilisateur a des articles dans son panier et clique sur un autre restaurant, une modale de confirmation apparaît : « Vous avez des articles dans votre panier actuel. Voulez-vous changer de restaurant ? Votre panier sera vidé. »
4. **Personnalisation visuelle** : les couleurs du restaurant sont posées en variables CSS (`--mm-color-primary`, `--mm-color-secondary`) via `theme.tsx`.

---

## 6. Administration de la plateforme

Les routes suivantes exigent un jeton d’un compte `platform_admin`.

- `POST /api/platform/restaurants` crée un restaurant et son premier compte administrateur dans une transaction. Corps attendu : `{ "slug", "name", "admin": { "name", "email", "phone", "password" } }`. Les champs visuels sont facultatifs ; les horaires initiaux sont 08 h–22 h, tous les jours.
- `PATCH /api/platform/restaurants/:slug/status` accepte `{ "status": "active" }` ou `{ "status": "inactive" }`. Les routes publiques masquent ensuite un restaurant inactif.

La liste publique, le profil, le menu, les images et les promotions sont raccordés à SQLite. L’administration des plats et des promotions est disponible via les routes du personnel ci-dessous.

### Gestion des promotions

Les routes `/api/admin/promotions` et `/api/admin/promotions/:id` sont réservées à l’administrateur du restaurant. Le restaurant est toujours déduit du jeton.

- `GET /api/admin/promotions` liste toutes les promotions du restaurant, y compris celles qui sont désactivées ou hors période.
- `POST /api/admin/promotions` crée une promotion. Champs : `type` (`promotion`, `event` ou `game`), `title`, `startDate`, `endDate`; `description`, `imageAssetId` et `isActive` sont facultatifs. Les dates doivent être ISO 8601 avec fuseau horaire et la fin doit être égale ou postérieure au début.
- `PATCH /api/admin/promotions/:id` modifie un ou plusieurs de ces champs. La période finale est vérifiée après fusion avec les valeurs existantes.
- `DELETE /api/admin/promotions/:id` supprime une promotion.
- Une promotion d’un autre restaurant répond `404 PROMOTION_NOT_FOUND`. Une image doit être une affiche (`poster`) du même restaurant.

Les dates de validité sont inclusives pour la route publique : une promotion active est visible à l’instant exact de son début et de sa fin.

## 7. Administration du menu

Toutes les routes déduisent le restaurant du compte authentifié ; aucun identifiant de restaurant fourni par le client n'est utilisé pour déterminer le périmètre.

### `GET /api/staff/menu`

Employé, gérant ou administrateur du restaurant. Renvoie les plats non supprimés logiquement, y compris ceux marqués indisponibles, dans l'ordre de leur position.

### `PATCH /api/staff/menu/:id`

Employé, gérant ou administrateur du restaurant. Corps accepté : `{ "isAvailable": false }`, `{ "isDaily": true }` ou les deux champs. Un autre champ est refusé.

### `POST /api/admin/menu`

Administrateur du restaurant uniquement. Corps : `{ "name", "description", "priceFc", "category", "isDaily", "isAvailable" }`. Les catégories permises sont `plat`, `boisson`, `dessert` et `snack`. Le prix est un entier FC positif ou nul.

### `PATCH /api/admin/menu/:id`

Administrateur du restaurant uniquement. Modifie partiellement les mêmes champs que la création.

### `DELETE /api/admin/menu/:id`

Administrateur du restaurant uniquement. Effectue une suppression logique afin de préserver les lignes de commande historiques.

Une ressource appartenant à un autre restaurant répond `404 MENU_ITEM_NOT_FOUND`. Les tests sont dans `backend/tests/menu-admin-api.test.ts`.

## État des tests

Les tests de lecture publique sont dans `backend/tests/restaurants-menu.test.ts`; la gestion des restaurants est couverte dans `backend/tests/platform-api.test.ts` et les promotions dans `backend/tests/promotions-api.test.ts`.

La gestion des comptes du personnel est décrite dans le [contrat dédié](staff-accounts.md) et testée dans `backend/tests/staff-accounts-api.test.ts`.
