# Intégration continue et déploiement

## Ce que fait la CI aujourd'hui

Le fichier [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) se lance à chaque envoi de code vers `dev` ou `main` et à chaque pull request.

| Tâche | Étapes |
|---|---|
| `backend` | installer les dépendances, vérifier les types, lancer les tests, vérifier le schéma de la base (`database/verifier.mjs`) |
| `frontend` | installer les dépendances, lancer les tests, vérifier les types et construire le site |

Node 22 est utilisé. Une pull request dont la CI échoue ne doit pas être fusionnée. Les branches `dev` et `main` sont protégées : une approbation est demandée avant fusion.

## Déploiement

| Élément | Plateforme | Déclenchement |
|---|---|---|
| Site | Vercel (offre gratuite) | à chaque fusion sur la branche liée au projet Vercel |
| API | Render (offre gratuite), décrite par `render.yaml` | à chaque fusion sur la branche liée au service Render |

La procédure détaillée, les variables d'environnement et les limites de l'offre gratuite (base recréée à chaque redémarrage, mise en veille) sont dans [deploiement.md](deploiement.md). L'installation en local est dans [installation.md](installation.md).

## Ce qui reste manuel

- Le **déploiement** n'est pas piloté par GitHub Actions : Vercel et Render se déclenchent eux-mêmes depuis GitHub. La CI ne bloque donc pas un déploiement ; c'est la protection des branches (CI verte avant fusion) qui le fait.
- Les **variables secrètes** (clé de signature, mots de passe de démonstration, clés du fournisseur de paiement) se saisissent dans les tableaux de bord Render et Vercel, jamais dans le dépôt.
- La **base de données** : avec l'offre gratuite, elle est vide à chaque redémarrage et remplie par le jeu de démonstration. Garder de vraies données demande un disque persistant ou une base externe.

## Évolution possible

Ajouter à la CI une tâche qui appelle `GET /api/health` sur l'API déployée après chaque fusion, et une tâche qui lance `npm audit --omit=dev` chaque semaine. Ces ajouts ne sont pas en place.
