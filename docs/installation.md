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
