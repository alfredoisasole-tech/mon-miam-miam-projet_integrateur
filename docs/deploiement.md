# Préparation du déploiement

## API sur Render

Le service doit garder la racine du dépôt comme répertoire racine : les migrations chargent `database/schema.sql`, situé en dehors de `backend/`. Render utilise déjà la racine du dépôt par défaut ; ne définissez pas `backend` comme `rootDir`.

Configuration prévue :

| Réglage | Valeur ou règle |
|---|---|
| Runtime | Node.js 22.18 ou plus récent |
| Répertoire racine | racine du dépôt |
| Installation | `npm ci --prefix backend` |
| Démarrage | `npm --prefix backend start` |
| Vérification de santé | `GET /api/health` |
| `DATABASE_PATH` | `/var/data/mon-miam-miam.sqlite` |
| Disque Render | disque persistant monté sur `/var/data` |
| `JWT_SECRET` | secret d’environnement d’au moins 32 caractères, jamais stocké dans Git |
| `PAYMENT_WEBHOOK_SECRET` | secret d’environnement d’au moins 32 caractères pour les signatures HMAC des webhooks, obligatoire en production et jamais stocké dans Git |
| `CORS_ORIGINS` | origine exacte du site Vercel, à renseigner avant le lancement |

Le code applique les migrations au démarrage. Sans disque persistant, les écritures du système de fichiers Render sont perdues lors d’un redémarrage ou d’un redéploiement. Un disque Render est limité à une instance de service ; SQLite sur ce disque ne doit donc pas être déployé avec plusieurs instances.

Le démarrage ne crée pas de restaurants, menus ni comptes : `database/schema.sql` ne contient que la structure. Les données du vérificateur et des tests ne doivent pas devenir les données de production. Avant le lancement, fournir les restaurants et menus réels, puis choisir un processus contrôlé pour les charger. Ne pas créer de comptes avec des mots de passe de démonstration.

Les routes de commandes restent protégées par `TokenResolver`. `main.ts` n’injecte pas encore de résolveur Lusimafu ; jusqu’à cette intégration, l’API refuse les jetons et les routes authentifiées répondent 401. L’API publique de restaurants et le contrôle de santé restent accessibles.

Références : [répertoire racine et monorepos Render](https://render.com/docs/monorepo-support), [disques persistants Render](https://render.com/docs/disks).

## Site sur Vercel et chemins d’images

L’API renvoie `logoUrl` et `imageUrl` sous forme de chemins relatifs, par exemple `/api/restaurants/alpha/assets/menu-1`. Le client HTTP du site utilise aussi `/api` par défaut. Une règle Vercel peut donc transférer les appels `/api/:path*` vers `https://<service-render>/api/:path*` ; le navigateur garde une URL de même origine pour l’API et les images.

Cette option est recommandée pour conserver les chemins du contrat. L’autre option consiste à faire renvoyer par l’API des URL absolues de Render, ce qui nécessiterait une adresse publique d’API configurée et un ajustement du contrat ou du service. La règle de réécriture n’est pas ajoutée avant validation du domaine Render et du domaine Vercel.

Vercel documente les réécritures vers des origines externes dans [sa documentation des rewrites](https://vercel.com/docs/routing/rewrites). À la mise en place, tester les requêtes API et les images sur un déploiement Preview ; vérifier aussi la stratégie de cache des réponses réécrites.

## Décisions restantes avant la mise en ligne

1. Confirmer le chemin `/var/data/mon-miam-miam.sqlite` et créer le disque persistant Render correspondant.
2. Fournir les données réelles des restaurants et menus, puis convenir du chargement initial.
3. Renseigner les domaines Vercel et Render, activer la réécriture recommandée et vérifier les images en Preview.
4. Brancher `TokenResolver` sur le résolveur d’identité Lusimafu.
5. Décider où activer ou désactiver `mobile_money` : le schéma actuel ne stocke pas ce réglage par restaurant, et la route commandes laisse les commandes mobile money à l’état `unpaid`.
