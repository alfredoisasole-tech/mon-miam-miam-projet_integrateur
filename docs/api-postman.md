# Guide de vérification de l'API avec Postman (Jira 20.3 / Fiche D-13)

Ce guide explique comment importer, configurer et exécuter la collection Postman officielle de **Mon Miam Miam** pour vérifier l'ensemble des endpoints et du cycle de vie des données.

---

## 1. Fichiers fournis

Les fichiers se trouvent dans le dossier `postman/` :

- **`postman/mon-miam-miam.postman_collection.json`** : la collection contenant toutes les requêtes ordonnées selon le contrat d'API (routes publiques, authentification, commandes, paiements, staff et plateforme), avec tests intégrés `pm.test`.
- **`postman/local.postman_environment.json`** : l'environnement local préconfiguré avec `baseUrl` et les comptes d'exemple du seed.

---

## 2. Préparation du backend

Avant d'exécuter la collection, préparez un backend neuf initialisé avec les données de démonstration :

```powershell
# 1. Se placer dans le dossier backend
cd backend

# 2. Exécuter le seed pour injecter les données de test
npm run seed

# 3. Démarrer le serveur HTTP
npm start
```

Le serveur écoute par défaut sur `http://localhost:3000`. L'API est accessible sous le préfixe `/api`.

---

## 3. Importation dans Postman

1. Ouvrez l'application **Postman**.
2. Cliquez sur le bouton **Import** (en haut à gauche).
3. Glissez-déposez les deux fichiers :
   - `postman/mon-miam-miam.postman_collection.json`
   - `postman/local.postman_environment.json`
4. En haut à droite de Postman, sélectionnez l'environnement actif **Mon Miam Miam - Local**.

---

## 4. Scénario d'exécution ordonné

La collection est structurée pour être exécutée de manière séquentielle (via le **Collection Runner** de Postman) :

1. **Public** :
   - Vérification de la route de santé `GET /api/health`
   - Récupération de la liste des restaurants actifs `GET /api/restaurants`
   - Profil et carte du restaurant `GET /api/restaurants/:slug/menu` (capture automatique d'un `menuItemId`)
   - Affichage des promotions actives
2. **Authentification** :
   - Connexion de l'étudiant de test `POST /api/auth/login` (sauvegarde automatique du jeton `studentToken`)
   - Vérification du profil `GET /api/me`
3. **Commandes & Paiement** :
   - Création d'une commande étudiante `POST /api/orders` avec en-tête `Idempotency-Key` (sauvegarde de `orderId`)
   - Consultation des détails de la commande `GET /api/orders/:id`
   - Initialisation du paiement mobile money `POST /api/orders/:id/pay` (capture de `paymentId`)
   - Simulation du paiement en environnement de test `POST /api/payments/:id/simulate`
4. **Personnel (Staff)** :
   - Connexion de l'employé `POST /api/auth/login`
   - Consultation des commandes du restaurant de l'employé `GET /api/staff/orders`
   - Mise à jour du statut vers `confirmed` `PATCH /api/staff/orders/:id/status`
5. **Plateforme** :
   - Connexion de l'administrateur plateforme `POST /api/auth/login`
   - Création d'un nouveau restaurant `POST /api/platform/restaurants`

---

## 5. Exécution automatique avec Newman (optionnel)

Si vous disposez de Newman en ligne de commande :

```powershell
npx newman run postman/mon-miam-miam.postman_collection.json -e postman/local.postman_environment.json
```

Tous les tests `pm.test` doivent être validés avec succès (100% vert).
