# E-7 — Écran des statistiques du restaurant

Responsable : Emmanuel Mboyo. Ticket : [APP-83 — Sous-tâche 18.2](https://judbie2030-45660043.atlassian.net/browse/APP-83). Branche : `feature/ecran-statistiques`, PR vers `dev`.

**Frontend développé et testé ; intégration réelle dépendante de L-11.** Le 2 novembre 2026, `dev` ne raccorde pas encore de contrôleur statistiques et aucune branche contenant « stat » n’a été trouvée. Le plan rattache L-11 aux tickets APP-82 et APP-84, encore à faire dans Jira lors du contrôle. Aucune modification ni réaffectation de ces tâches backend n’est incluse.

## Écran et accès

La route `/staff/overview` utilise la protection `RequireRole` existante et autorise uniquement `manager` et `admin`. Un visiteur est redirigé vers la connexion ; étudiant, employé et administrateur plateforme n’exécutent pas le chargement du bilan global. Le bilan hebdomadaire destiné à l’employé (`/staff/weekly`) relève de son endpoint distinct et n’est pas ajouté par E-7.

La page affiche :

- Trois périodes : Aujourd’hui (`day`), Semaine (`week`), Mois (`month`).
- Ventes en FC, nombre de commandes (avec détail des états) et panier moyen arrondi au FC pour l’affichage.
- Plats les plus vendus, triés par quantité décroissante, avec barres proportionnelles et valeurs textuelles accessibles.
- Chargement, erreur avec reprise manuelle, état vide et heure de la dernière mise à jour en `Africa/Kinshasa`.
- Actualisation automatique toutes les 30 secondes, sans superposer les requêtes d’une même période.

## Contrat provisoire et raccordement

Le contrôleur `src/controllers/stats.ts` appelle réellement le client HTTP commun :

```http
GET /api/staff/stats/overview?period=day|week|month
Authorization: Bearer <jeton de session>
```

L’API choisit le restaurant à partir du personnel authentifié. Le frontend n’ajoute pas de paramètre permettant de choisir un autre restaurant.

Le sous-ensemble ci-dessous reprend les champs de `Overview` dans le brouillon fourni. **Il doit être confirmé avec l’implémentation L-11 avant validation de l’intégration.** Les champs supplémentaires du brouillon ne sont pas nécessaires à E-7.

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

La branche part du dernier `dev` récupéré le 2 novembre. Celui-ci contient E-5 mais pas E-6 : la PR #36 a été fusionnée dans `feature/charte-composants` après la fusion d’E-5. Le commit E-6 déjà livré est donc repris par une fusion locale de `feature/mise-en-page` afin de disposer du layout et de sa navigation. Le diff vers `dev` contient ainsi E-6 et les nouveaux fichiers E-7 ; ce point est signalé à la relecture. La branche distante `dev` n’a pas été fusionnée ou modifiée directement.

## Vérifications exécutées le 2 novembre 2026

**85 tests frontend réussis**, dont **16 tests E-7** : chiffres, classement, période, zéro vente, reprise après erreur, rôles autorisés/refusés, intervalle de 30 secondes, nettoyage, isolation des réponses, panne de rafraîchissement, refus d’accès, contrat invalide et requêtes non superposées. Typage TypeScript et build Vite réussis.

L’aperçu a été chargé dans le navigateur et contrôlé par son DOM : à 360 px, document de 345 px sans débordement horizontal et grille sur une colonne ; passage à la semaine (840 000 FC de démonstration) et affichage de l’état vide vérifiés. La capture d’écran du navigateur a échoué : aucun contrôle visuel par capture n’est annoncé comme réussi.

```sh
cd frontend
npm test
npm run build
npm run dev
```

Ouvrir `/stats.html` pour l’aperçu de développement : données fictives explicitement signalées, périodes et scénarios chargement/erreur/aucune vente. Cet aperçu n’appelle pas l’API et n’est pas inclus dans la page métier.

## Conditions avant clôture

1. Intégrer L-11 et confirmer le contrat ci-dessus.
2. Vérifier avec des comptes gérant et administrateur les chiffres réels, l’isolation entre restaurants, les refus d’accès et les périodes définies côté serveur en heure de Kinshasa.
3. Faire relire par un autre binôme puis fusionner la PR vers `dev` avec les contrôles requis. La PR reste en brouillon en attendant cette intégration.
