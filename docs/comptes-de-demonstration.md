# Comptes de démonstration

Ces comptes n'existent que dans les bases de démonstration (jeu de données `npm run seed`). Ils ne servent qu'aux essais et aux présentations : leurs mots de passe sont publics et ne doivent jamais être utilisés en production.

Mot de passe de démonstration : celui choisi au lancement du seed (`SEED_*_PASSWORD`). Pour la démonstration locale, tous les comptes utilisent `Demo12345`.

## Restaurants

| Restaurant | Adresse | Charte | Cuisine |
|---|---|---|---|
| ZeDuc@Space | `/r/zeduc-space/menu` | vert, mode sombre, logo | plats congolais (riz-haricots, pondu, moambe, brochettes) |
| Chez Léa | `/r/chez-lea/menu` | brique, mode clair, logo | plats congolais, cuisine familiale |
| Wok Kinois | `/r/wok-kinois/menu` | rouge, mode sombre, sans logo | wok : nouilles, riz cantonais, nems, crevettes |
| Pizza Unikin | `/r/pizza-unikin/menu` | orange, mode clair, sans logo | pizzas, pâtes, tiramisu |

Les restaurants sans logo montrent une pastille avec leur initiale : c'est le comportement attendu tant que l'administrateur n'a pas importé de logo (**Paramètres**).

## Personnel et plateforme

| Rôle | E-mail | Restaurant |
|---|---|---|
| Administrateur de la plateforme | `plateforme@monmiam.test` | — |
| Administrateur | `admin@zeduc-space.test` | ZeDuc@Space |
| Employé | `employe@monmiam.test` | ZeDuc@Space |
| Administrateur | `admin@chez-lea.test` | Chez Léa |
| Administrateur | `admin@wok-kinois.test` | Wok Kinois |
| Employé | `employe@wok-kinois.test` | Wok Kinois |
| Administrateur | `admin@pizza-unikin.test` | Pizza Unikin |
| Employé | `employe@pizza-unikin.test` | Pizza Unikin |

## Client

| E-mail | Particularité |
|---|---|
| `etudiant@monmiam.test` | Compte de la plateforme, adhérent d'office à ZeDuc@Space et Chez Léa (points visibles) ; il adhère aux autres restaurants à sa première commande. |

Tout visiteur peut aussi créer son propre compte depuis **Inscription** : aucun restaurant n'est à choisir.

## Paiement simulé

Avec `PAYMENT_PROVIDER=simulation` (valeur par défaut, hors production), le paiement Mobile Money ouvre une page « Paiement Mobile Money (simulation) » : **Approuver le paiement**, **Simuler un échec** ou **Annuler**. Aucun argent n'est débité et aucun compte Easypay n'est nécessaire. En production, ou avec Easypay, cette page est refusée par l'API.
