# Préparation du déploiement

## API sur Render

Le service doit garder la racine du dépôt comme répertoire racine : les migrations chargent `database/schema.sql`, situé en dehors de `backend/`. Render utilise déjà la racine du dépôt par défaut ; ne définissez pas `backend` comme `rootDir`.

**Décision de l'équipe (3 novembre 2026) : offres gratuites pour tous les hébergements** (Render pour l'API, Vercel pour le site). Le Blueprint `render.yaml` décrit cette configuration. Conséquences pour l'API, à ma connaissance et à vérifier dans la documentation de Render :

- **Pas de disque persistant** sur l'offre gratuite : la base SQLite est recréée vide à chaque redémarrage, mise en veille puis réveil, ou nouveau déploiement. Les comptes et les commandes créés disparaissent, et aucun restaurant n'existe après un redémarrage tant que des données ne sont pas rechargées.
- **Mise en veille** après une période d'inactivité : la première requête suivante est lente, et une notification de paiement reçue pendant le sommeil peut être manquée.
- **Comptes de démonstration à chaque démarrage :** une base vide n'a ni restaurant ni compte (même l'administrateur de la plateforme n'existe pas), donc `render.yaml` lance `npm run seed` avant `npm start`. Les mots de passe viennent des variables `SEED_*` saisies dans Render. Ce seed de démonstration est **réservé à cet usage** : il ne doit pas servir à de vraies données (voir [installation.md](installation.md)).
- Adapté à une **démonstration**, pas à des données réelles. Pour conserver la base, il faudra une formule payante avec disque (voir l'historique de `render.yaml`) ou une base externe, ce qui demande une évolution du code.

Configuration prévue :

| Réglage | Valeur ou règle |
|---|---|
| Runtime | Node.js 22.18 ou plus récent |
| Répertoire racine | racine du dépôt |
| Installation | `npm ci --prefix backend` |
| Démarrage | `npm --prefix backend start` |
| Vérification de santé | `GET /api/health` |
| Offre Render | gratuite (`plan: free`) |
| `DATABASE_PATH` | `/tmp/mon-miam-miam.sqlite` (stockage temporaire) |
| Disque Render | aucun (non disponible sur l'offre gratuite) |
| `JWT_SECRET` | secret d’environnement d’au moins 32 caractères, jamais stocké dans Git |
| `PAYMENT_WEBHOOK_SECRET` | secret d’environnement d’au moins 32 caractères pour les signatures HMAC des webhooks, obligatoire en production et jamais stocké dans Git |
| `CORS_ORIGINS` | origine exacte du site Vercel, à renseigner avant le lancement |

Le code applique les migrations au démarrage : les tables sont donc recréées à chaque démarrage. Sans disque persistant, les écritures du système de fichiers Render sont perdues lors d’un redémarrage ou d’un redéploiement. Avec une formule payante et un disque, ce disque est limité à une instance de service : SQLite ne doit alors pas être déployé avec plusieurs instances.

Le démarrage ne crée pas de restaurants, menus ni comptes : `database/schema.sql` ne contient que la structure. Les données du vérificateur et des tests ne doivent pas devenir les données de production. Avant le lancement, fournir les restaurants et menus réels, puis choisir un processus contrôlé pour les charger. Ne pas créer de comptes avec des mots de passe de démonstration.

Les routes authentifiées utilisent le service de connexion de l’API (`AuthService`, jetons signés avec `JWT_SECRET`) : `main.ts` n’a pas besoin d’y injecter de résolveur. Vérifié le 2 novembre 2026 sur une base initialisée avec le seed : connexion par `POST /api/auth/login`, puis `GET /api/orders` répond 200 avec le jeton. Sans jeton, ces routes répondent 401 ; l’API publique de restaurants et le contrôle de santé restent accessibles.

Références : [répertoire racine et monorepos Render](https://render.com/docs/monorepo-support), [disques persistants Render](https://render.com/docs/disks).

## Site sur Vercel et chemins d’images

L’API renvoie `logoUrl` et `imageUrl` sous forme de chemins relatifs, par exemple `/api/restaurants/alpha/assets/menu-1`. Le client HTTP du site utilise aussi `/api` par défaut. Une règle Vercel peut donc transférer les appels `/api/:path*` vers `https://<service-render>/api/:path*` ; le navigateur garde une URL de même origine pour l’API et les images.

Cette option est recommandée pour conserver les chemins du contrat. L’autre option consiste à faire renvoyer par l’API des URL absolues de Render, ce qui nécessiterait une adresse publique d’API configurée et un ajustement du contrat ou du service. La règle de réécriture n’est pas ajoutée avant validation du domaine Render et du domaine Vercel.

Vercel documente les réécritures vers des origines externes dans [sa documentation des rewrites](https://vercel.com/docs/routing/rewrites). À la mise en place, tester les requêtes API et les images sur un déploiement Preview ; vérifier aussi la stratégie de cache des réponses réécrites.

## Décisions restantes avant la mise en ligne

1. ~~Décider comment la démonstration obtient ses données après chaque redémarrage de l'offre gratuite~~ : décidé, le seed de démonstration est rejoué à chaque démarrage (`render.yaml`), avec ses quatre mots de passe saisis dans Render. Le jour où l'API doit conserver ses données, passer à une formule avec disque et retirer le seed du démarrage.
2. Fournir les données réelles des restaurants et menus, puis convenir du chargement initial, si l'API doit un jour conserver des données.
3. Renseigner les domaines Vercel et Render, activer la réécriture recommandée et vérifier les images en Preview.
4. Décider où activer ou désactiver `mobile_money` : le schéma actuel ne stocke pas ce réglage par restaurant, et la route commandes laisse les commandes mobile money à l’état `unpaid`.
