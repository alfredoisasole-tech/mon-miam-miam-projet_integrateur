# Conventions Git et revue de code

Ce document fixe les règles communes pour les branches, les commits et les pull requests du projet.

## Noms de branches

Créez une branche courte, en minuscules, avec un préfixe qui indique le type de travail :

- `feature/` pour une fonctionnalité, par exemple `feature/base-de-donnees` ;
- `fix/` pour corriger un défaut, par exemple `fix/validation-commande` ;
- `test/` pour ajouter ou corriger des tests, par exemple `test/permissions` ;
- `docs/` pour la documentation, par exemple `docs/conventions-git` ;
- `chore/` pour la maintenance et la configuration, par exemple `chore/installation-base`.

Une branche porte un sujet cohérent. Si plusieurs commits appartiennent à la même tâche, gardez-les ensemble sur cette branche.

## Messages de commit

Écrivez les messages sous la forme `type(zone): verbe et changement`, avec un verbe à l’impératif. Faites un commit par idée ; évitez les messages vagues comme `mise à jour` ou `corrections`.

Exemples tirés du plan de travail :

- `feat(db): ajouter la connexion SQLite et l’exécuteur de migrations`
- `docs(donnees): valider le modèle de données`
- `feat(db): créer les tables et leurs relations`
- `feat(db): ajouter les contraintes d’intégrité et leurs tests`
- `feat(menu): exposer la liste des restaurants et leur menu`

Les préfixes courants sont `feat` (fonctionnalité), `fix` (correction), `test` (tests), `docs` (documentation) et `chore` (maintenance).

## Créer une pull request

Ouvrez une pull request de votre branche vers `dev`. Dans sa description, indiquez le problème traité, les changements réalisés et les vérifications effectuées, avec leur résultat. N’annoncez comme réussis que les contrôles réellement exécutés.

Avant la fusion, la CI doit être verte et au moins un autre membre doit avoir relu les changements. Respectez également les règles de propriété des fichiers partagés définies par l’équipe.

## Relire une pull request

Vérifiez que :

1. les changements répondent à la tâche et restent dans son périmètre ;
2. le code est lisible et n’introduit pas de secret ou de donnée sensible ;
3. les cas d’erreur et les accès par rôle ou restaurant sont traités lorsqu’ils sont concernés ;
4. les tests et la CI couvrent les changements, et leurs résultats sont verts ;
5. la documentation est mise à jour si le comportement ou les consignes changent.

Si tout est correct, approuvez la pull request avec **Approve** et laissez un commentaire bref. Si une correction est nécessaire, choisissez **Request changes** et indiquez le fichier, le problème observé et le changement attendu. Posez une question dans un commentaire lorsqu’un point doit être clarifié.

## Fusionner

Après l’approbation et une CI verte, fusionnez avec **Create a merge commit**. Conservez ainsi les commits individuels de la branche dans l’historique de `dev`.

## Résoudre un conflit

Mettez votre branche à jour avec `dev` en utilisant `git rebase dev`, puis résolvez chaque conflit. Lisez les deux versions et gardez les deux ajouts lorsqu’ils sont tous les deux nécessaires ; ne supprimez pas silencieusement le travail d’un autre membre. Si le bon choix n’est pas évident, demandez au propriétaire du fichier avant de continuer. Relancez les vérifications après résolution, puis mettez à jour la pull request.
