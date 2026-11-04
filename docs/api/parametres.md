# Contrat d'API — paramètres et personnalisation du restaurant

Chaque restaurant choisit lui-même sa **direction artistique** (couleurs, logo, police, mode clair ou sombre), ses horaires, sa livraison et ses règles de fidélité. Ces choix sont des **données du restaurant** : les modifier ne demande aucun redéploiement, et ils ne changent jamais l'aspect des autres restaurants.

Réservé à l'**administrateur** du restaurant (le restaurant vient du jeton). Les autres rôles reçoivent `403 FORBIDDEN`, sans jeton `401 UNAUTHORIZED`. Les erreurs ont la forme `{ "error": { "code", "message", "details" } }`.

## `GET /api/admin/settings`

```json
{
  "restaurant": { "slug": "zeduc-space", "name": "ZeDuc@Space", "tagline": "Le goût de la terrasse" },
  "brand": {
    "primaryColor": "#cfbd97", "secondaryColor": "#000000", "fontFamily": "Poppins", "defaultMode": "light",
    "logoAssetId": "ast_8f2c", "logoUrl": "/api/restaurants/zeduc-space/assets/ast_8f2c"
  },
  "openingHours": { "mon": [{ "open": "10:00", "close": "22:00" }] },
  "delivery": { "enabled": true, "feeFc": 1000, "communes": ["Gombe", "Limete"] },
  "loyalty": { "spendPerPointFc": 3000, "pointsForReward": 15, "rewardValueFc": 3000, "validityMonths": 12 }
}
```

## `PATCH /api/admin/settings`

Corps : un ou plusieurs blocs ci-dessous, chacun avec **au moins un champ**. Les champs inconnus sont refusés (`400 VALIDATION_ERROR`). Réponse `200` : les réglages complets, comme `GET`.

| Bloc | Champ | Règle |
|---|---|---|
| racine | `name` | 2 à 80 caractères |
| racine | `tagline` | au plus 120 caractères, `null` pour l'effacer |
| `brand` | `primaryColor`, `secondaryColor` | `#rrggbb` (six chiffres hexadécimaux), rangées en minuscules ; tout autre format est refusé |
| `brand` | `fontFamily` | `Poppins`, `Arial`, `Verdana`, `Trebuchet MS`, `Georgia`, `Tahoma` ou `Times New Roman` |
| `brand` | `defaultMode` | `light`, `dark` ou `system` |
| `brand` | `logoAssetId` | identifiant d'un logo envoyé par ce restaurant (`422 ASSET_NOT_FOUND` sinon), ou `null` |
| `openingHours` | `mon` … `sun` | liste de 3 plages au plus, `{ "open": "HH:MM", "close": "HH:MM" }`, l'ouverture avant la fermeture, sans chevauchement. Un jour absent est fermé. L'objet remplace les horaires précédents. |
| `delivery` | `enabled` | booléen |
| `delivery` | `feeFc` | entier de 0 à 100 000 |
| `delivery` | `communes` | 30 noms au plus, de 1 à 40 caractères |
| `loyalty` | `spendPerPointFc` | entier de 100 à 1 000 000 (3 000 par défaut : 3 000 FC dépensés = 1 point) |
| `loyalty` | `pointsForReward` | entier de 1 à 1 000 (15 par défaut) |
| `loyalty` | `rewardValueFc` | entier de 100 à 1 000 000 (3 000 par défaut : 15 points = 3 000 FC de réduction) |
| `loyalty` | `validityMonths` | entier de 1 à 60 (12 par défaut) |

Les nouvelles règles s'appliquent aux **prochaines commandes** ; les points déjà gagnés gardent la date d'expiration qu'ils avaient.

Le profil public (`GET /api/restaurants/:slug`, voir [restaurants.md](restaurants.md)) reflète immédiatement la charte.

## `POST /api/admin/assets`

Envoie une image du restaurant (logo, affiche de promotion, photo de plat).

```json
{ "kind": "logo", "data": "<image encodée en base64>" }
```

| Champ | Règle |
|---|---|
| `kind` | `logo`, `poster` (affiche d'une promotion) ou `menu` (photo d'un plat) |
| `data` | base64 standard de l'image, **512 Ko au plus** |

Le type est déduit de la **signature des octets** : seuls PNG, JPEG et WebP sont acceptés. Un SVG ou tout autre fichier répond `400 UNSUPPORTED_IMAGE`. Trop gros : `413 IMAGE_TOO_LARGE`.

Réponse `201 Created` : `{ "id", "kind", "mime", "size", "url" }`. L'identifiant sert ensuite à `brand.logoAssetId`, à `imageAssetId` d'une promotion (affiche) ou d'un plat (voir ci-dessous). L'adresse `url` est publique, au même titre que les autres images du restaurant.

## Photo d'un plat

`POST /api/admin/menu` et `PATCH /api/admin/menu/:id` acceptent `imageAssetId` (identifiant d'une image de type `menu` de ce restaurant, ou `null` pour retirer la photo). Une image d'un autre restaurant répond `422 ASSET_NOT_FOUND`. À la création, `imageAssetId` est facultatif.
