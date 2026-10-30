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

Le numéro du ticket Jira n’est pas obligatoire dans le nom de la branche. Vous pouvez l’ajouter si cela vous aide, par exemple `feature/APP-79-points-fidelite`.

## Messages de commit

Écrivez les messages sous la forme `type(zone): message`, avec un verbe à l’infinitif ou un groupe nominal court. Faites un commit par idée ; évitez les messages vagues comme `mise à jour` ou `corrections`. Ajoutez les fichiers un par un avec `git add chemin/du/fichier`, jamais avec `git add -A`. Écrivez les tests avant le code (TDD) lorsque la tâche comporte du code.

Exemples :

- `test(fidelite): tests de la reduction fixe de 3 000 FC`
- `feat(fidelite): 15 points = 3 000 FC de reduction fixe`
- `docs(api): contrat v2 (compte unique, restaurants, paiement)`

Les préfixes courants sont `feat` (fonctionnalité), `fix` (correction), `test` (tests), `docs` (documentation) et `chore` (maintenance).

## Créer une pull request

Ouvrez une pull request de votre branche vers `dev`. Commencez son titre par le numéro du ticket Jira le plus précis de la tâche (la sous-tâche plutôt que la user story), par exemple `APP-38 docs(git): définir les conventions de branches, de commits et de revue`. Jira reste la référence pour les tâches ; si aucun ticket n’existe, demandez qu’il soit créé avant d’ouvrir la pull request. Dans sa description, indiquez le problème traité, les changements réalisés et les vérifications effectuées, avec leur résultat. N’annoncez comme réussis que les contrôles réellement exécutés. Un collègue d’un autre binôme relit la pull request.

Avant la fusion, la CI doit être verte lorsqu’elle est en place et au moins un autre membre doit avoir relu les changements. Respectez également les règles de propriété des fichiers partagés définies par l’équipe : demandez aussi une relecture à leur propriétaire lorsqu’une pull request les modifie. Lorsqu’une évolution de la base passe par des migrations, ne modifiez jamais une migration déjà fusionnée ; ajoutez-en une nouvelle.

## Relire une pull request

Vérifiez que :

1. les changements répondent à la tâche et restent dans son périmètre ;
2. le code est lisible et n’introduit pas de secret ou de donnée sensible ;
3. les cas d’erreur et les accès par rôle ou restaurant sont traités lorsqu’ils sont concernés ;
4. les tests couvrent les changements et sont réussis ; la CI est verte lorsqu’elle est en place ;
5. la documentation est mise à jour si le comportement ou les consignes changent.

Si tout est correct, approuvez la pull request avec **Approve** et laissez un commentaire bref. Si une correction est nécessaire, choisissez **Request changes** et indiquez le fichier, le problème observé et le changement attendu. Posez une question dans un commentaire lorsqu’un point doit être clarifié.

## Fusionner

Après l’approbation et une CI verte lorsqu’elle est en place, fusionnez avec **Create a merge commit**. Conservez ainsi les commits individuels de la branche dans l’historique de `dev`. L’équipe vise deux points de fusion par jour, à 12 h 30 et à 17 h 30.

## Résoudre un conflit

Mettez votre branche à jour avec `dev` en utilisant `git rebase dev`, puis résolvez chaque conflit. Lisez les deux versions et gardez les deux ajouts lorsqu’ils sont tous les deux nécessaires ; ne supprimez pas silencieusement le travail d’un autre membre. Si le bon choix n’est pas évident, demandez au propriétaire du fichier avant de continuer. Relancez les vérifications après résolution, puis mettez à jour la pull request.
