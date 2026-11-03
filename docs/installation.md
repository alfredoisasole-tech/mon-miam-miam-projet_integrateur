# Guide d'installation et de configuration

Ce guide explique comment installer et lancer Mon Miam Miam (API + site). Le déploiement en ligne (Render, Vercel) est décrit dans [deploiement.md](deploiement.md).

## 1. Prérequis

| Outil | Version | Pourquoi |
|---|---|---|
| Node.js | **22.18 ou plus récent** | l'API utilise `node:sqlite` et exécute directement le TypeScript (`engines` de `backend/package.json`) |
| npm | fourni avec Node.js | installation des dépendances (`npm ci`) |
| Git | récent | récupérer le dépôt |

Il n'y a **aucune base de données à installer** : l'API utilise SQLite intégré à Node.js, dans un simple fichier (voir `DATABASE_PATH`).

Le dépôt doit être cloné **en entier** : l'API lit le schéma dans `database/schema.sql`, situé en dehors de `backend/`. Ne copiez pas `backend/` seul sur un serveur.

```bash
git clone https://github.com/alfredoisasole-tech/mon-miam-miam-projet_integrateur.git
cd mon-miam-miam-projet_integrateur
node --version   # doit afficher v22.18 ou plus
```

## 2. Variables d'environnement

### API (`backend/.env`)

Copiez le modèle puis adaptez-le. Le fichier `.env` est ignoré par Git : **ne le publiez jamais** et ne mettez aucun secret dans le dépôt.

```bash
cp backend/.env.example backend/.env
```

| Variable | Obligatoire | Valeur par défaut | Rôle |
|---|---|---|---|
| `NODE_ENV` | non | `development` | `development`, `test` ou `production`. En `production`, les contrôles de secrets ci-dessous sont obligatoires. |
| `PORT` | non | `3000` | Port d'écoute de l'API (entier de 1 à 65535). |
| `DATABASE_PATH` | non | `./data/mon-miam-miam.sqlite` | Fichier SQLite. Le dossier est créé au démarrage. En production, il doit être sur un stockage persistant (ex. `/var/data/mon-miam-miam.sqlite`). |
| `JWT_SECRET` | **oui en production** | valeur de développement | Signature des jetons de connexion. 32 caractères minimum, différent de la valeur d'exemple. |
| `PAYMENT_WEBHOOK_SECRET` | **oui en production** | valeur de développement | Signature HMAC des webhooks de paiement. 32 caractères minimum, différent de la valeur d'exemple. |
| `CORS_ORIGINS` | non | `http://localhost:5173` | Adresses du site autorisées à appeler l'API, séparées par des virgules (origine exacte, sans `/` final). |
| `PAYMENT_PROVIDER` | non | `simulation` | Fournisseur de paiement : `simulation` ou `easypay` (voir [easypay.md](api/easypay.md)). |
| `EASYPAY_MODE` | non | `sandbox` | `sandbox` (essais) ou `v1` (production), seulement avec `easypay`. |
| `EASYPAY_CID` | **oui avec `easypay`** | — | Identifiant de corrélation du marchand Easypay. |
| `EASYPAY_TOKEN` | **oui avec `easypay`** | — | Clé de l'espace développeur Easypay. Elle voyage dans l'adresse des appels : ne jamais la journaliser. |
| `EASYPAY_IPN_KEY` | **oui avec `easypay`** | — | Clé secrète de l'adresse de notification (32 caractères minimum). |
| `SITE_URL` | **oui avec `easypay`** | — | Adresse publique du site, sans `/` final (`https` en production) : adresses de retour après paiement. |
| `SEED_RESTAURANT_ADMIN_PASSWORD` | seulement pour `npm run seed` | — | Mot de passe des administrateurs de restaurant de démonstration. |
| `SEED_EMPLOYEE_PASSWORD` | seulement pour `npm run seed` | — | Mot de passe de l'employé de démonstration. |
| `SEED_STUDENT_PASSWORD` | seulement pour `npm run seed` | — | Mot de passe de l'étudiant de démonstration. |
| `SEED_PLATFORM_ADMIN_PASSWORD` | seulement pour `npm run seed` | — | Mot de passe de l'administrateur de la plateforme de démonstration. |

Règles :

- Les quatre mots de passe `SEED_*` doivent contenir **8 caractères minimum, une majuscule et un chiffre**.
- En `production`, l'API **refuse de démarrer** (message « Configuration invalide ») si `JWT_SECRET` ou `PAYMENT_WEBHOOK_SECRET` est trop court ou reprend une valeur d'exemple.
- Pour générer un secret :

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

### Site (`frontend/.env`)

| Variable | Obligatoire | Valeur par défaut | Rôle |
|---|---|---|---|
| `VITE_API_URL` | non | `/api` | Adresse de l'API. En développement, laissez vide : le proxy de Vite relaie `/api` vers `http://localhost:3000`. En production, voir [deploiement.md](deploiement.md). |

`VITE_API_URL` est lue au moment de la construction du site (`npm run build`) et se retrouve dans le code envoyé au navigateur : n'y mettez jamais de secret.

## 3. Paramètres et ports

| Élément | Valeur | Remarque |
|---|---|---|
| API | `http://localhost:3000` | santé : `GET /api/health` |
| Site (développement) | `http://localhost:5173` | proxy `/api` → `http://localhost:3000` (`frontend/vite.config.ts`) |
| Écoute de l'API | `0.0.0.0` | l'API écoute sur toutes les interfaces |
| Arrêt | `SIGTERM` / `SIGINT` | arrêt propre : les requêtes en cours se terminent |

## 4. Lancer l'application

Dans deux terminaux :

```bash
# Terminal 1 : API
cd backend
npm ci
npm run dev        # ou : npm start

# Terminal 2 : site
cd frontend
npm ci
npm run dev
```

## 5. Préparer la base de données

La base est un fichier SQLite (`DATABASE_PATH`). Aucune installation de serveur de base de données n'est nécessaire.

### Créer les tables

Les tables sont définies dans `database/schema.sql` (migration `001_initial`), puis complétées par des migrations numérotées dans `backend/src/db/migrations.ts`. Il y a deux façons de les créer :

- **Automatiquement** : l'API applique les migrations à chaque démarrage (`npm start` ou `npm run dev`).
- **Sans démarrer l'API** (préparation d'un serveur, d'un disque neuf) :

```bash
cd backend
npm run db:migrate
```

Ce script crée le dossier et le fichier si besoin, applique les migrations manquantes et affiche le nombre de migrations appliquées. Il peut être rejoué sans danger. Une migration déjà fusionnée ne se modifie jamais : tout changement de la base ajoute une nouvelle migration.

### Initialiser les données de démonstration (facultatif)

Le démarrage ne crée **aucun** restaurant, menu ni compte. Pour disposer de données de test en développement, renseignez les quatre mots de passe `SEED_*` (voir section 2) dans `backend/.env` ou dans l'environnement, puis :

```bash
cd backend
npm run seed
```

Le script crée les tables si nécessaire, puis ajoute :

| Donnée | Contenu |
|---|---|
| Restaurants | `zeduc-space` (ZeDuc@Space) et `chez-lea` (Chez Léa) |
| Menu | 10 plats par restaurant |
| Comptes | un administrateur par restaurant, un employé, un étudiant (inscrit aux deux restaurants) et un administrateur de la plateforme |

Les adresses e-mail des comptes sont dans `backend/src/seed.ts` ; les mots de passe sont ceux que vous avez fournis. Le seed est **rejouable** : si les deux restaurants existent déjà, il affiche « Données de démonstration déjà présentes » et ne modifie rien.

**Ne jamais utiliser ce seed pour de vraies données** : ce sont des comptes de démonstration. Seule exception : l'hébergement de démonstration sur l'offre gratuite de Render, dont la base repart vide à chaque démarrage et où le seed est rejoué au lancement (voir [deploiement.md](deploiement.md)). Les données réelles (restaurants, menus) doivent être chargées par un processus contrôlé, comme décrit dans [deploiement.md](deploiement.md).

### Fichiers de test SQL

`database/donnees-test.sql` contient un jeu de données utilisé uniquement par `node database/verifier.mjs` (contrôle du schéma en mémoire, lancé par la CI). Ses mots de passe sont des empreintes factices inutilisables : ne le chargez pas dans une base réelle.

### Repartir de zéro (développement)

Arrêtez l'API, supprimez le fichier de base, puis relancez `npm run db:migrate` (et `npm run seed`) :

```bash
rm backend/data/mon-miam-miam.sqlite*
```

## 6. Vérifications après installation

À exécuter dans l'ordre, depuis un clone neuf, après avoir copié `backend/.env.example` en `backend/.env` (avec les quatre mots de passe `SEED_*` si vous voulez des données de démonstration).

| # | Commande | Résultat attendu |
|---|---|---|
| 1 | `cd backend && npm ci` | installation sans erreur |
| 2 | `npm run typecheck` | aucune erreur |
| 3 | `npm test` | tous les tests passent (116 au 2 novembre 2026) |
| 4 | `node ../database/verifier.mjs` | « Vérification des contraintes et des données de test réussie. » |
| 5 | `npm run db:migrate` | « Base prête : … (5 migrations appliquées). » |
| 6 | `npm run seed` | « Données de démonstration créées. » (ou « déjà présentes » au 2e passage) |
| 7 | `npm start` | « API prête sur le port 3000 (development). » |
| 8 | `curl localhost:3000/api/health` | `{"status":"ok","time":"…"}` |
| 9 | `curl localhost:3000/api/restaurants` | liste avec `chez-lea` et `zeduc-space` |
| 10 | `curl localhost:3000/api/restaurants/zeduc-space/menu` | menu de 10 plats répartis par catégories |
| 11 | `curl -o /dev/null -w "%{http_code}" localhost:3000/api/staff/menu` | `401` (route protégée, jeton absent) |
| 12 | `cd ../frontend && npm ci && npm test` | tous les tests passent (93 au 2 novembre 2026) |
| 13 | `npm run build` | typage et construction réussis, dossier `dist/` créé |
| 14 | `npm run dev` puis ouvrir `http://localhost:5173` | le site s'affiche (HTTP 200), y compris le rechargement direct de `/menu` |
| 15 | `curl localhost:5173/api/health` | même réponse qu'à l'étape 8 : le proxy du site atteint l'API |

Les étapes 8 à 11 et 15 nécessitent que l'API tourne (étape 7) ; l'étape 15 nécessite aussi que le site tourne (étape 14). Les étapes 9 et 10 supposent que le seed a été exécuté (étape 6).

Dernière vérification complète : 2 novembre 2026, clone neuf, Node.js 22.23.4, toutes les étapes ci-dessus réussies. L'avertissement « SQLite is an experimental feature » affiché par Node.js est normal.

### En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| « … doit être défini dans l'environnement » au seed | un mot de passe `SEED_*` manque | renseigner les quatre variables dans `backend/.env` |
| Erreur de lecture de `database/schema.sql` | API lancée sans le dépôt complet | cloner le dépôt entier, ne pas copier `backend/` seul |
| Le site s'affiche mais les données sont vides ou en erreur | API arrêtée, ou seed non exécuté | vérifier l'étape 8, puis l'étape 6 |
| Erreur CORS dans le navigateur | l'adresse du site n'est pas dans `CORS_ORIGINS` | ajouter l'origine exacte (sans `/` final) |
| Une route d'étudiant ou de personnel répond 401 | jeton absent, invalide ou expiré | se connecter avec `POST /api/auth/login` (`identifier` et `password`), puis envoyer l'en-tête `Authorization: Bearer <jeton>` ; sans données de démonstration, aucun compte n'existe (voir section 5) |

Pour le choix d’un disque persistant, les sauvegardes et la restauration, voir le [guide de la base SQLite](installation-base.md).
