# E-7 — Écran des statistiques du restaurant

Responsable : Emmanuel Mboyo. Ticket : [APP-83 — Sous-tâche 18.2](https://judbie2030-45660043.atlassian.net/browse/APP-83). Branche : `feature/ecran-statistiques`, PR vers `dev`.

**Compatibilité avec L-11 vérifiée ; fusion de l’API encore nécessaire dans `dev`.** Le 2 novembre 2026, E-7 a été testé avec `dev` au commit `218cb2b` et la [PR #43 — L-11, APP-82](https://github.com/alfredoisasole-tech/mon-miam-miam-projet_integrateur/pull/43), au commit `59a4a50`. La vérification d’intégration utilise une copie locale qui conserve les imports du paiement et des statistiques dans `backend/src/app.ts`. Ce correctif local ne modifie pas la branche de Lusimafu et n’ajoute pas l’API L-11 dans la PR E-7. La PR #43 doit être intégrée avant de disposer de l’API dans `dev`.

## Écran et accès

La route `/staff/overview` utilise la protection `RequireRole` existante et autorise uniquement `manager` et `admin`. Un visiteur est redirigé vers la connexion ; étudiant, employé et administrateur plateforme n’exécutent pas le chargement du bilan global. Le bilan hebdomadaire destiné à l’employé (`/staff/weekly`) relève de son endpoint distinct et n’est pas ajouté par E-7.

La page affiche :

- Trois périodes : Aujourd’hui (`day`), Semaine (`week`), Mois (`month`).
- Ventes en FC, nombre de commandes (avec détail des états) et panier moyen arrondi au FC pour l’affichage.
- Plats les plus vendus, triés par quantité décroissante, avec barres proportionnelles et valeurs textuelles accessibles.
- Chargement, erreur avec reprise manuelle, état vide et heure de la dernière mise à jour en `Africa/Kinshasa`.
- Actualisation automatique toutes les 30 secondes, sans superposer les requêtes d’une même période.

## Contrat vérifié et raccordement

Le contrôleur `src/controllers/stats.ts` appelle réellement le client HTTP commun :

```http
GET /api/staff/stats/overview?period=day|week|month
Authorization: Bearer <jeton de session>
```

L’API choisit le restaurant à partir du personnel authentifié. Le frontend n’ajoute pas de paramètre permettant de choisir un autre restaurant.

Le sous-ensemble ci-dessous correspond aux champs de `StatsOverview` utilisés par E-7 et vérifiés avec l’implémentation L-11 de la PR #43. Les champs supplémentaires renvoyés par le serveur (`from`, `to`, `orders.byStatus`, `topItems[].revenueFc`) sont compatibles et ne sont pas nécessaires à l’affichage E-7.

```json
{
  "period": "day",
  "salesFc": 120000,
  "averageOrderFc": 4000,
  "orders": { "total": 35, "completed": 30, "active": 3, "cancelled": 2 },
  "topItems": [{ "name": "Poulet mayonnaise", "quantity": 20 }]
}
```

Les ventes doivent correspondre aux commandes terminées ; leur calcul reste celui du serveur. Le contrôleur vérifie la période, les champs nécessaires, les montants finis et non négatifs ainsi que les compteurs entiers. Une réponse incompatible affiche une erreur ; des champs manquants ne deviennent pas de faux zéros. Une API absente affiche également une erreur : aucune donnée fictive n’est injectée dans l’application.

Un changement de période ou de clé de session/restaurant masque immédiatement les anciens chiffres et ignore les anciennes réponses. En cas de panne pendant un rafraîchissement, les valeurs précédentes restent accompagnées d’un avertissement et de leur date. Un refus 401/403 les efface. Les minuteurs sont supprimés au démontage.

## Base Git et dépendance E-6

La branche `feature/ecran-statistiques` intègre `dev` au commit `218cb2b`, qui contient désormais E-6 via la PR #44, l’inscription, la connexion et le paiement simulé. Le seul conflit, dans `frontend/src/App.tsx`, est résolu en conservant la version de `dev` et en ajoutant `/staff/overview` sous `RequireRole` pour `manager` et `admin`. Les routes d’accueil, `/menu`, `/login`, `/register` et la page 404 sont conservées. Le diff vers `dev` porte sur E-7 ; la branche de Lusimafu et la branche distante `dev` ne sont pas modifiées par cette mise à jour.

## Vérifications exécutées le 2 novembre 2026

Après intégration de `dev` : **107 tests frontend réussis dans 16 fichiers**, dont **16 tests E-7** et un nouveau contrôle de la route protégée dans l’application complète. Ils couvrent les chiffres, le classement, la période, zéro vente, la reprise après erreur, les rôles autorisés/refusés, l’intervalle de 30 secondes, le nettoyage, l’isolation des réponses, les pannes de rafraîchissement, les refus d’accès, le contrat invalide et les requêtes non superposées. Typage TypeScript et build Vite réussis avec Node.js 24.

La copie d’intégration `dev` + E-7 + L-11 passe également **120 tests backend**, ainsi que le typage backend. Les sources frontend y ont été comparées par empreinte aux fichiers de la branche E-7. Le conflit d’imports de `backend/src/app.ts` a été résolu uniquement dans cette copie de vérification en conservant les deux blocs.

Contrôle HTTP réel supplémentaire : base SQLite temporaire avec données de démonstration, authentification par `/api/auth/login` et commandes terminées avec montants connus. Les jetons et mots de passe temporaires ne sont pas publiés.

| Vérification | Résultat |
| --- | --- |
| Bilan administrateur et gérant, `day`, `week`, `month` | 200 ; contrat et chiffres attendus |
| Autre restaurant | 200 ; ventes isolées de celles du premier restaurant |
| Bilan employé | 403 |
| Bilan étudiant | 403 |
| Sans connexion | 401 |
| Période `year` | 400 |

L’aperçu a été chargé dans le navigateur et contrôlé par son DOM : à 360 px, document de 345 px sans débordement horizontal et grille sur une colonne ; passage à la semaine (840 000 FC de démonstration) et affichage de l’état vide vérifiés. La capture d’écran du navigateur a échoué : aucun contrôle visuel par capture n’est annoncé comme réussi.

```sh
cd frontend
npm test
npm run build
npm run dev
```

Ouvrir `/stats.html` pour l’aperçu de développement : données fictives explicitement signalées, périodes et scénarios chargement/erreur/aucune vente. Cet aperçu n’appelle pas l’API et n’est pas inclus dans la page métier.

## Conditions avant clôture

1. Intégrer la PR #43 (L-11) dans `dev`, en conservant les imports du paiement et des statistiques dans `backend/src/app.ts`.
2. Faire relire E-7 par un autre binôme, vérifier la CI sur la branche mise à jour et fusionner vers `dev` avec les contrôles requis.
3. Ne pas confondre la compatibilité locale vérifiée avec un déploiement public de l’API : ce déploiement ne fait pas partie de la présente vérification.
