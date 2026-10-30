# Répartition des responsabilités des binômes

Ce document présente les quatre binômes de Mon Miam Miam, leurs missions et leur participation aux 22 user stories du projet APP. Il permet à chacun d’identifier le responsable d’une story et les personnes avec qui coordonner sa réalisation.

- **Tâche :** [APP-37 - Répartir les responsabilités des binômes](https://judbie2030-45660043.atlassian.net/browse/APP-37), sous-tâche 2.1 de [US2 - APP-10](https://judbie2030-45660043.atlassian.net/browse/APP-10).
- **Rédacteur :** Emmanuel Mboyo (`emmanuelmboyo-dotcom`).
- **Répartition Jira vérifiée le :** 27 octobre 2026.
- **Validation du document :** relecture de Judy à obtenir avant fusion.

## Les quatre binômes

Les missions ci-dessous décrivent le travail technique de chaque binôme. La dernière colonne reprend les étiquettes `binome-a`, `binome-b`, `binome-c` et `binome-d` présentes sur les stories Jira à la date de vérification. Une story commune apparaît donc dans plusieurs lignes.

| Binôme | Membres et pseudos GitHub | Missions principales | Stories rattachées dans Jira |
| --- | --- | --- | --- |
| **A** | Emmanuel Mboyo (`emmanuelmboyo-dotcom`) ; Judbie Kikombo, dite Judy (`Judbie-Kikombo`) | Organisation et règles communes, maquettes et charte graphique, composants et navigation, interface de la plateforme, écran des statistiques, tests de bout en bout et démonstration. | [US1](https://judbie2030-45660043.atlassian.net/browse/APP-9), [US2](https://judbie2030-45660043.atlassian.net/browse/APP-10), [US5](https://judbie2030-45660043.atlassian.net/browse/APP-13), [US16](https://judbie2030-45660043.atlassian.net/browse/APP-24), [US18](https://judbie2030-45660043.atlassian.net/browse/APP-26), [US19](https://judbie2030-45660043.atlassian.net/browse/APP-27), [US22](https://judbie2030-45660043.atlassian.net/browse/APP-30) |
| **B** | Gloire Nkulu (`Gloirenk17`) ; Brayan Bolia (`bryanbolia`) | Application React, session et parcours étudiant/personnel : restaurants, menus, promotions, panier, commandes et paiement côté interface ; calcul et affichage des points de fidélité. | [US1](https://judbie2030-45660043.atlassian.net/browse/APP-9), [US2](https://judbie2030-45660043.atlassian.net/browse/APP-10), [US6](https://judbie2030-45660043.atlassian.net/browse/APP-14), [US7](https://judbie2030-45660043.atlassian.net/browse/APP-15), [US8](https://judbie2030-45660043.atlassian.net/browse/APP-16), [US9](https://judbie2030-45660043.atlassian.net/browse/APP-17), [US10](https://judbie2030-45660043.atlassian.net/browse/APP-18), [US11](https://judbie2030-45660043.atlassian.net/browse/APP-19), [US13](https://judbie2030-45660043.atlassian.net/browse/APP-21), [US14](https://judbie2030-45660043.atlassian.net/browse/APP-22), [US15](https://judbie2030-45660043.atlassian.net/browse/APP-23), [US17](https://judbie2030-45660043.atlassian.net/browse/APP-25), [US19](https://judbie2030-45660043.atlassian.net/browse/APP-27), [US22](https://judbie2030-45660043.atlassian.net/browse/APP-30) |
| **C** | Dondedieu Amampakandi, dit Don (`dondedieuamampakandi-source`) ; Credo Lusimafu (`Lusimafu`) | Modèle de données et SQLite, serveur HTTP et API, authentification et permissions, commandes, menus, promotions, personnel, statistiques et isolation des restaurants. | [US3](https://judbie2030-45660043.atlassian.net/browse/APP-11), [US4](https://judbie2030-45660043.atlassian.net/browse/APP-12), [US6](https://judbie2030-45660043.atlassian.net/browse/APP-14), [US7](https://judbie2030-45660043.atlassian.net/browse/APP-15), [US8](https://judbie2030-45660043.atlassian.net/browse/APP-16), [US9](https://judbie2030-45660043.atlassian.net/browse/APP-17), [US10](https://judbie2030-45660043.atlassian.net/browse/APP-18), [US12](https://judbie2030-45660043.atlassian.net/browse/APP-20), [US13](https://judbie2030-45660043.atlassian.net/browse/APP-21), [US14](https://judbie2030-45660043.atlassian.net/browse/APP-22), [US16](https://judbie2030-45660043.atlassian.net/browse/APP-24), [US18](https://judbie2030-45660043.atlassian.net/browse/APP-26), [US19](https://judbie2030-45660043.atlassian.net/browse/APP-27), [US20](https://judbie2030-45660043.atlassian.net/browse/APP-28), [US22](https://judbie2030-45660043.atlassian.net/browse/APP-30) |
| **D** | Alfredo Isasole, propriétaire du dépôt (`alfredoisasole-tech`) ; Don-Gabriel Mpanano, dit Gabriel (`Mp130201`) | Socle du dépôt et intégration continue, choix techniques, contrat d’API, paiement simulé côté serveur, suivi de commande, sécurisation de la fidélité, préparation du déploiement et livraison. | [US5](https://judbie2030-45660043.atlassian.net/browse/APP-13), [US13](https://judbie2030-45660043.atlassian.net/browse/APP-21), [US17](https://judbie2030-45660043.atlassian.net/browse/APP-25), [US19](https://judbie2030-45660043.atlassian.net/browse/APP-27), [US20](https://judbie2030-45660043.atlassian.net/browse/APP-28), [US21](https://judbie2030-45660043.atlassian.net/browse/APP-29), [US22](https://judbie2030-45660043.atlassian.net/browse/APP-30) |

## Correspondance des 22 stories avec Jira

Le responsable indiqué est la personne assignée à la story dans Jira. Elle en assure le suivi ; les tâches techniques peuvent être réparties entre plusieurs personnes. Le numéro d’US et la clé Jira sont différents : par exemple, US2 correspond à APP-10, et sa sous-tâche 2.1 correspond à APP-37.

| Story | Lien Jira | Objet | Responsable assigné dans Jira | Binômes étiquetés dans Jira |
| --- | --- | --- | --- | --- |
| US1 | [APP-9](https://judbie2030-45660043.atlassian.net/browse/APP-9) | Définir les règles de la plateforme | Judbie KIKOMBO | A, B |
| US2 | [APP-10](https://judbie2030-45660043.atlassian.net/browse/APP-10) | Organiser le travail des quatre binômes | MBOYO Emmanuel | A, B |
| US3 | [APP-11](https://judbie2030-45660043.atlassian.net/browse/APP-11) | Concevoir le modèle de données | Dondedieu AMAMPAKANDI | C |
| US4 | [APP-12](https://judbie2030-45660043.atlassian.net/browse/APP-12) | Créer la structure de la base de données | Credo LUSIMAFU | C |
| US5 | [APP-13](https://judbie2030-45660043.atlassian.net/browse/APP-13) | Préparer l’architecture technique | Alfredo ISASOLE | A, D |
| US6 | [APP-14](https://judbie2030-45660043.atlassian.net/browse/APP-14) | Inscrire et connecter un utilisateur | GLOIRE NKULU | B, C |
| US7 | [APP-15](https://judbie2030-45660043.atlassian.net/browse/APP-15) | Gérer les rôles et les permissions | Brayan BOLIA | B, C |
| US8 | [APP-16](https://judbie2030-45660043.atlassian.net/browse/APP-16) | Consulter les menus et les plats | Brayan BOLIA | B, C |
| US9 | [APP-17](https://judbie2030-45660043.atlassian.net/browse/APP-17) | Gérer les plats et les catégories | Credo LUSIMAFU | B, C |
| US10 | [APP-18](https://judbie2030-45660043.atlassian.net/browse/APP-18) | Consulter les promotions | Dondedieu AMAMPAKANDI | B, C |
| US11 | [APP-19](https://judbie2030-45660043.atlassian.net/browse/APP-19) | Sélectionner un restaurant | GLOIRE NKULU | B |
| US12 | [APP-20](https://judbie2030-45660043.atlassian.net/browse/APP-20) | Rattacher le personnel à son restaurant | Credo LUSIMAFU | C |
| US13 | [APP-21](https://judbie2030-45660043.atlassian.net/browse/APP-21) | Créer et suivre une commande | Don-Gabriel MPANANO | B, C, D |
| US14 | [APP-22](https://judbie2030-45660043.atlassian.net/browse/APP-22) | Gérer les commandes reçues | GLOIRE NKULU | B, C |
| US15 | [APP-23](https://judbie2030-45660043.atlassian.net/browse/APP-23) | Payer une commande | Brayan BOLIA | B |
| US16 | [APP-24](https://judbie2030-45660043.atlassian.net/browse/APP-24) | Administrer les restaurants | Judbie KIKOMBO | A, C |
| US17 | [APP-25](https://judbie2030-45660043.atlassian.net/browse/APP-25) | Gérer les points de fidélité | Alfredo ISASOLE | B, D |
| US18 | [APP-26](https://judbie2030-45660043.atlassian.net/browse/APP-26) | Consulter les statistiques du restaurant | MBOYO Emmanuel | A, C |
| US19 | [APP-27](https://judbie2030-45660043.atlassian.net/browse/APP-27) | Tester les fonctionnalités et les permissions | Judbie KIKOMBO | A, B, C, D |
| US20 | [APP-28](https://judbie2030-45660043.atlassian.net/browse/APP-28) | Documenter les API | Don-Gabriel MPANANO | C, D |
| US21 | [APP-29](https://judbie2030-45660043.atlassian.net/browse/APP-29) | Préparer le déploiement de l’application | Alfredo ISASOLE | D |
| US22 | [APP-30](https://judbie2030-45660043.atlassian.net/browse/APP-30) | Préparer la livraison et le bilan du projet | Judbie KIKOMBO | A, B, C, D |

## Coordination entre les binômes

| Travail commun | Répartition des contributions |
| --- | --- |
| Règles, architecture et organisation | Judy et Emmanuel documentent les rôles, les règles multi-restaurants et l’organisation ; Gloire documente les règles de commande et de paiement ; Lusimafu formalise les conventions Git ; Alfredo prépare le dépôt et les choix techniques. |
| Interfaces et API | A fournit les maquettes, la charte et les composants communs. B réalise les principaux parcours React. C fournit les API et les contrôles serveur. Gabriel coordonne le contrat d’API avec les personnes qui l’implémentent et l’utilisent. |
| Commandes et paiement | Gabriel développe le panier ([APP-67](https://judbie2030-45660043.atlassian.net/browse/APP-67)), enregistre et valide la commande ([APP-68](https://judbie2030-45660043.atlassian.net/browse/APP-68)) et affiche le suivi de commande ([APP-69](https://judbie2030-45660043.atlassian.net/browse/APP-69)) ; Brayan prend en charge le paiement ([APP-23](https://judbie2030-45660043.atlassian.net/browse/APP-23)) ; Gloire gère les commandes reçues par le restaurant ([APP-22](https://judbie2030-45660043.atlassian.net/browse/APP-22)). |
| Fidélité | Gloire réalise le calcul et l’affichage des points ; Brayan applique la remise dans le parcours de commande ; Alfredo vérifie qu’un solde ne peut pas être utilisé deux fois. |
| Statistiques | Lusimafu calcule les indicateurs côté serveur ; Emmanuel réalise leur affichage dans l’espace du restaurant. |
| Administration de la plateforme | Judy réalise l’interface ; Don fournit les API et leurs protections. Les données restent isolées par restaurant. |
| Tests et livraison | Chaque binôme vérifie ses changements. Judy coordonne les parcours de bout en bout et la démonstration ; Alfredo rassemble le rapport de tests et les éléments de livraison ; les autres membres apportent leurs résultats et leur documentation. |

Les étiquettes des stories ne détaillent pas toutes ces contributions. Un point doit notamment être confirmé par Judy : Lusimafu, du binôme C, prépare l’installation de la base alors que US21 porte seulement l’étiquette D. Cette contribution est indiquée ici sans modifier les affectations Jira.

## Relecture et intégration

La branche initiale de cette documentation est `docs/equipe.md`. La pull request vise `dev` et reprend la référence APP-37. Judy vérifie la composition des binômes, la correspondance des stories et les contributions partagées avant la fusion. Le statut « Terminé » d’APP-37 dans Jira ne constitue pas, à lui seul, une validation de ce fichier.

Pour les relectures habituelles, B relit les PR de A, C celles de B, D celles de C et A celles de D. Les changements apportés aux fichiers partagés sont également relus par leur propriétaire. Les règles de branche, de commit et de fusion sont définies dans [les conventions Git](conventions-git.md).

Tout changement de responsabilité est reporté dans Jira et dans ce document. Une affectation n’est pas modifiée silencieusement pendant l’implémentation.
