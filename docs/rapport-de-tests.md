# Rapport de tests

Ce rapport répond au livrable « Rapport de test avec couverture des fonctionnalités principales ». Il décrit ce qui est testé, comment relancer les tests et ce qui ne l'est pas.

## Résultats de la version complète (3 novembre 2026)

| Partie | Outil | Tests | Résultat |
|---|---|---|---|
| Serveur (API, règles métier, base de données) | `node:test` | 363 | tous réussis |
| Site (écrans, contrôleurs) | Vitest | 267 | tous réussis |
| Typage | `tsc --noEmit` (serveur et site) | — | sans erreur |
| Construction du site | `vite build` | — | réussie |

Ces nombres sont ceux de `dev` après fusion de toutes les évolutions de la version complète. Ils sont recalculés à chaque envoi de code par l'intégration continue (voir [ci-cd.md](ci-cd.md)).

## Relancer les tests

```bash
cd backend && npm run typecheck && npm test
```

```bash
cd frontend && npm run typecheck && npm test && npm run build
```

Les tests du serveur utilisent une base SQLite **en mémoire** : aucune donnée réelle n'est touchée. Les tests du site simulent l'API.

## Couverture des fonctionnalités

La colonne « Fichiers » donne les fichiers de test les plus représentatifs (dans `backend/tests/` et `frontend/src/test/`).

| Fonctionnalité du cahier des charges | Ce qui est vérifié | Fichiers |
|---|---|---|
| Inscription, connexion, rôles | validation des champs, e-mail et téléphone uniques, jeton, accès par rôle, blocage après trop d'essais | `auth-api`, `isolation`, `login`, `register`, `require-role` |
| Mot de passe oublié et changement | code à durée limitée, mot de passe faible refusé, anciens jetons invalidés, mot de passe temporaire à changer | `auth-api`, `account-api`, `account-pages`, `require-role` |
| Restaurants, menu, plat du jour | profil public, menu séparé par restaurant, plats indisponibles masqués, images contrôlées | `restaurants-menu`, `menu-admin-api`, `menu`, `admin-menu` |
| Commande (sur place, livraison) | prix recalculés par le serveur, restaurant unique par commande, rejeu sans doublon, statuts, annulation | `orders`, `orders-sqlite`, `orders-tracking`, `cart-page`, `my-orders` |
| Paiement | espèces, mobile money simulé, notification signée, montant vérifié, aucune confirmation côté site | `payments`, `payments-amount`, `payments-easypay-ipn`, `payment-return` |
| Fidélité | 3 000 FC = 1 point, 15 points = 3 000 FC de réduction, points par restaurant, expiration à 12 mois, plafond | `loyalty-earning`, `loyalty-redemption`, `loyalty-balance`, `loyalty-security`, `loyalty` |
| Parrainage | code global, code inconnu refusé, récompense à la première commande qualifiante, nom du filleul masqué | `referral-api`, `community` |
| Avis après livraison | note de 1 à 5, un seul avis par commande, commande terminée seulement | `order-review-api`, `my-orders` |
| Top 10 des clients | classement par commandes terminées, jour, semaine, mois à l'heure de Kinshasa, noms masqués | `top-clients-api`, `community` |
| Réclamations | circuit étudiant, employé, gérant, administrateur pour les points ; limite de cinq ; isolation par restaurant | `claims-api`, `claims-pages` |
| Personnalisation du restaurant | couleurs, police, mode, logo, horaires, livraison, fidélité ; isolation entre restaurants | `settings-api`, `theme`, `admin-settings` |
| Données personnelles (RGPD) | export du compte, suppression anonymisante, refus s'il reste une commande en cours | `account-api`, `account-pages`, `parcours-complet` |
| Comptes du personnel, promotions, plateforme | création, désactivation, mot de passe temporaire, dates de promotion, liste des restaurants | `staff-accounts-api`, `promotions-api`, `platform-api`, `platform-list-api` (PR #79), `admin-pages` |
| Statistiques | bilan jour, semaine, mois ; ventes de la semaine de l'employé | `api/stats`, `api/stats-access`, `stats`, `weekly-stats` |
| Cookies et pages légales | choix mémorisé, liens vers la politique de confidentialité | `legal-cookies` |
| Mini-jeux | trois jeux locaux, sans points | `community` |
| Parcours complet | charte, parrainage, commande, avis, top 10, points, export, suppression, changement de mot de passe | `parcours-complet` |

## Ce qui n'est pas couvert

- **Paiement mobile money réel** : seul le mode simulé est testé automatiquement. Le fournisseur réel doit être essayé à la main avec ses clés de test avant toute ouverture au public.
- **Envoi du code de mot de passe oublié** : aucun service d'envoi (SMS ou e-mail) n'est branché. Hors production, le code est écrit dans les journaux du serveur ; en production la demande répond 503. Cet envoi est donc à tester à la main une fois le fournisseur choisi.
- **Navigateurs et appareils** : les tests du site tournent dans un navigateur simulé (jsdom). La mise en page sur téléphone doit être vérifiée à la main (voir [plan-beta.md](plan-beta.md)).
- **Charge** : aucun test de montée en charge n'a été fait.
- **Accessibilité** : les rôles et les libellés sont vérifiés par les tests, mais pas avec un lecteur d'écran.
