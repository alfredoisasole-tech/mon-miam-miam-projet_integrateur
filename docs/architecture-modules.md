# Architecture des Modules Front-end et Back-end

Ce document décrit l'architecture technique de l'application Mon Miam Miam, organisée selon le patron de conception MVC (Modèle-Vue-Contrôleur), décliné à la fois côté serveur et côté navigateur.

## 1. Principe du Double MVC

L'application est séparée en deux parties distinctes qui communiquent via une API REST :

### Côté Serveur (Backend - Node.js / TypeScript)
- **Modèle** : Composé des `repositories/` (accès brut aux données SQLite) et des `services/` (règles métier pures, calculs, validations).
- **Contrôleur** : Les `controllers/` et le `router.ts` qui reçoivent les requêtes HTTP, valident les données d'entrée, invoquent les services et formatent la réponse.
- **Vue** : La réponse JSON structurée renvoyée au client (pas de rendu HTML, sauf pour la page de simulation de paiement).

### Côté Navigateur (Frontend - React / Vite / TypeScript)
- **Modèle** : Le dossier `models/` qui contient les types TypeScript et les fonctions d'appel à l'API (client HTTP centralisé gérant les tokens et les erreurs).
- **Contrôleur** : Les `controllers/` (hooks React et Contextes) qui gèrent l'état local, les effets de bord (appels API via les modèles) et la logique d'interaction.
- **Vue** : Le dossier `views/` (pages et composants UI) qui se contente d'afficher les données fournies par les contrôleurs et de déclencher des actions, sans jamais appeler `fetch` directement.

## 2. Schéma d'Architecture

```mermaid
graph TD
    subgraph Frontend ["Frontend (React + Vite)"]
        V[Views / Pages / Composants] -->|Déclenche une action| C[Controllers / Hooks / Context]
        C -->|Appelle| M[Models / Client HTTP]
    end

    subgraph API ["API REST (Node.js)"]
        M -->|Requête HTTP + JWT| R[Router / Middleware]
        R -->|Valide et route| Ctrl[Controllers HTTP]
        Ctrl -->|Exécute la logique| S[Services / Règles métier]
        S -->|Lit / Écrit| D[(Repositories / SQLite)]
        S -->|Retourne le résultat| Ctrl
        Ctrl -->|Réponse JSON| R
    end

    R -->|Réponse JSON| M
    M -->|Met à jour l'état| C
    C -->|Rafraîchit l'affichage| V