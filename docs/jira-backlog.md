# Backlog Initial et User Stories (US) - Mon Miam Miam

Ce document sert de référence pour la création des tickets dans Jira. Chaque User Story (US) suit le format : "En tant que [rôle], je veux [action] afin de [bénéfice]." avec des critères d'acceptation (CA) clairs.

## Epic 1 : Socle et Organisation du projet
**Objectif** : Organisation, conventions et coordination

Définir le cadre de travail du projet, organiser les tâches des quatre binômes, établir les conventions de développement, suivre les échéances et documenter les décisions techniques et organisationnelles.

- **User Story 1 — Définir les règles de la plateforme** : En tant qu’équipe de développement, nous voulons définir les règles de fonctionnement de la plateforme afin que les quatre binômes travaillent selon les mêmes décisions.

Critères d’acceptation:

- Les rôles des utilisateurs sont définis.
- Les règles de commande et de paiement sont précisées.
- Les règles de gestion des restaurants sont définies.

- **User Story 2 — Organiser le travail des quatre binômes** : En tant qu’équipe de développement, nous voulons définir une organisation commune et des conventions de travail afin de faciliter la collaboration, le suivi des tâches et l’intégration du code.

Critères d’acceptation:

- Les responsabilités des binômes A, B, C et D sont définies.
- Les conventions de nommage des branches et des commits sont documentées.
- Les règles d’utilisation de Git et des Pull Requests sont précisées.
- Le suivi des tâches et des échéances est organisé dans Jira.
- **User Story 5 — Préparer l’architecture technique** : En tant qu’équipe, nous voulons définir l’architecture technique afin de séparer clairement le front-end, le back-end et la base de données.

Critères d’acceptation :

- Les technologies et l’organisation des dossiers sont documentées.
- Les échanges entre front-end et API sont définis.
- Les conventions de configuration et de gestion des erreurs sont précisées.
- **User Story 6 — Inscrire et connecter un utilisateur** : En tant qu’utilisateur, je veux créer un compte et me connecter pour accéder aux fonctionnalités autorisées.

Critères d’acceptation :

- Un utilisateur peut s’inscrire avec des informations valides.
- Il peut se connecter avec son adresse e-mail et son mot de passe.
- Les mots de passe sont stockés de manière sécurisée.
- Les erreurs de connexion sont correctement affichées.
- Une déconnexion met fin à la session.

## Epic 2 : Conception et base de données
**Objectif** : Concevoir une base de données fiable pour gérer les utilisateurs, les restaurants, les menus, les commandes, les promotions, les paiements et les réclamations, en assurant la cohérence des relations entre les données.

- **User Story 3 — Concevoir le modèle de données** : En tant qu’équipe de développement, nous voulons concevoir le modèle de données afin de stocker correctement les informations de la plateforme.

Critères d’acceptation :

- Les entités utilisateurs, restaurants, menus, plats, commandes, promotions et paiements sont identifiées.
- Les relations et cardinalités sont définies.
- Les clés primaires et étrangères sont identifiées.
- Le modèle est validé avant la création de la base.
- **US-2.2** : En tant qu'employé, je veux marquer un plat comme "épuisé" ou "plat du jour" afin de mettre à jour le menu temporairement.

## Epic 3 : Authentification et gestion des utilisateurs
**Objectif** : Mettre en place l'inscription, la connexion, la gestion des sessions et des rôles, ainsi que le rattachement des étudiants, employés, gérants et administrateurs à leur restaurant lorsque cela s'applique.


- **User Story 4 — Créer la structure de la base de données** : En tant que développeur, je veux créer la base de données afin de rendre les données persistantes et accessibles à l’application.

Critères d’acceptation :

- Les tables et relations du modèle sont créées.
- Les contraintes d’intégrité sont configurées.
- Les données d’un restaurant sont associées au bon restaurant.
- Un jeu de données de test permet de vérifier le fonctionnement.
- **User Story 7 — Gérer les rôles et les permissions** : En tant qu’administrateur, je veux attribuer des rôles afin que chaque utilisateur accède uniquement aux fonctionnalités qui lui sont autorisées.

Critères d’acceptation :

- Les rôles étudiant, employé, responsable et administrateur sont définis.
- Les routes sensibles vérifient les permissions côté serveur.
- Un utilisateur non autorisé ne peut pas effectuer une action protégée.

## Epic 4 : Commandes
**Objectif** : Permettre aux étudiants de consulter les offres, composer leur panier, passer des commandes et suivre leur état, tout en garantissant le rattachement de chaque commande au bon restaurant et à son utilisateur

- **User Story 13 — Créer et suivre une commande** :En tant qu’étudiant, je veux ajouter des plats au panier et confirmer ma commande afin de commander facilement.

Critères d’acceptation :

- L’étudiant peut ajouter et retirer des plats du panier.
Le total est calculé correctement.
- La commande est enregistrée avec ses plats, quantités, utilisateur et restaurant.
- L’étudiant peut consulter le statut de sa commande.
- Le serveur vérifie les prix et la disponibilité avant validation.
- **User Story 14 — Gérer les commandes reçues** : En tant qu’employé de restaurant, je veux consulter et mettre à jour les commandes afin de suivre leur préparation.

Critères d’acceptation :

- L’employé voit uniquement les commandes de son restaurant.
- Il peut modifier le statut selon les transitions autorisées.
- L’étudiant voit le statut actualisé.
- Les modifications sont enregistrées en base de données.
- **User Story 15 — Payer une commande** : En tant qu’étudiant, je veux payer ma commande via le moyen de paiement proposé afin de finaliser mon achat.

Critères d’acceptation :

- L’étudiant peut choisir le moyen de paiement disponible.
- La redirection vers le prestataire et le retour sont gérés.
- Les retours de succès et d’échec sont affichés.
- Une commande n’est marquée comme payée qu’après confirmation serveur vérifiée.
- Le mode sandbox est utilisé pour les tests.
- **User Story 17 — Gérer les points de fidélité**: En tant qu’étudiant, je veux gagner et utiliser des points de fidélité afin de bénéficier de réductions sur mes commandes.

Critères d’acceptation :

- Les points sont calculés selon les règles validées.
- Le solde est associé au compte de l’étudiant.
- Une remise de 3 000 FC correspond à 15 points.
- Le solde est mis à jour après confirmation de la transaction concernée.
- Les points ne peuvent pas être utilisés plusieurs fois pour la même remise.

## Epic 5 : Menus et promotions
**Objectis** : Développer la gestion et la consultation des plats, catégories, disponibilités et promotions, avec des données propres à chaque restaurant et un affichage adapté au restaurant sélectionné par l'étudiant.

- **User Story 8 — Consulter les menus et les plats** : En tant qu’étudiant, je veux consulter les plats disponibles afin de choisir ce que je souhaite commander.

Critères d’acceptation :

- Les plats affichent leur nom, prix, description et disponibilité.
- Les plats sont organisés par catégories.
- Seuls les plats disponibles peuvent être commandés.
- Les plats affichés correspondent au restaurant sélectionné.
- **Gérer les plats et les catégories** : En tant que responsable de restaurant, je veux créer, modifier et désactiver les plats afin de maintenir un menu à jour.

Critères d’acceptation :

- Un responsable autorisé peut ajouter et modifier un plat.
- Il peut gérer les catégories.
- Il peut rendre un plat indisponible.
- Il ne peut modifier que les données de son restaurant.
- **User Story 10 — Consulter les promotions** : En tant qu’étudiant, je veux consulter les promotions actives afin de connaître les offres disponibles.

Critères d’acceptation :

- Les promotions affichent leur réduction et leur période de validité.
- Une promotion expirée ou désactivée n’est plus proposée.
- Les promotions sont propres au restaurant concerné.

## Epic 6 : Administration et gestion des paiements
**Objectifs** : Développer les fonctionnalités d'administration et intégrer le paiement des commandes, notamment le choix du mode de paiement, la communication avec l'agrégateur, la confirmation côté serveur et l'utilisation des points de fidélité.

- **User Story 18 — Consulter les statistiques du restaurant** : En tant que responsable de restaurant, je veux consulter les statistiques de mon restaurant afin de suivre son activité.

Critères d’acceptation :

- Les statistiques affichent le nombre de commandes et les montants pertinents.
- Les données sont calculées à partir des commandes enregistrées.
- Un responsable ne voit que les statistiques de son restaurant.
- Les données sont actualisées à partir de la base de données.

## Epic 7 : Tests, déploiement et documentation
**Objectifs** : Assurer la qualité de l'application par les tests fonctionnels et de sécurité, préparer l'intégration continue et le déploiement, rédiger la documentation technique et le guide d'installation, et produire les rapports d'avancement et de tests.

- **User Story 19 — Tester les fonctionnalités et les permissions** : En tant qu’équipe de développement, nous voulons tester les fonctionnalités afin de détecter les erreurs avant la livraison.

Critères d’acceptation :

- Les principales fonctionnalités possèdent des tests adaptés.
- Les cas de connexion, commande et paiement sont vérifiés.
- Les accès entre restaurants sont testés.
- Les erreurs identifiées sont documentées et corrigées selon leur priorité.
- **User Story 20 — Documenter les API** : En tant que développeur, je veux documenter les API afin que les membres de l’équipe puissent les utiliser et les tester facilement.

Critères d’acceptation :

- Les routes, méthodes HTTP et paramètres sont documentés.
- Les exemples de requêtes et réponses sont disponibles.
- Les principaux codes d’erreur sont décrits.
- Les endpoints importants sont vérifiés avec Postman.
- **User Story 21 — Préparer le déploiement de l’application** : En tant qu’équipe, nous voulons préparer le déploiement afin de pouvoir installer et lancer l’application dans un environnement défini.

Critères d’acceptation :

Les étapes d’installation sont documentées.
- Les variables de configuration sensibles ne sont pas exposées dans le dépôt.
- La base de données peut être initialisée à partir des scripts fournis.
- Le front-end et le back-end peuvent être lancés selon les instructions.
- Les vérifications essentielles après installation sont documentées.
- **User Story 22 — Préparer la livraison et le bilan du projet** : En tant qu’équipe, nous voulons préparer le bilan final afin de présenter l’avancement, les résultats des tests et les limites de l’application.

Critères d’acceptation :

- Le rapport d’avancement et le bilan des tests sont disponibles.
- Les fonctionnalités terminées et celles restant à améliorer sont identifiées.
- Les anomalies connues sont documentées.
- Une démonstration de l’application peut être réalisée.

## Epic 8 — Plusieurs restaurants 
**Objectifs** : Permettre à la plateforme de gérer plusieurs restaurants indépendants, proposer à l'étudiant de choisir son restaurant, rattacher le personnel et les données à chaque établissement, isoler les accès et fournir un espace d'administration centralisé pour gérer les restaurants.

- **User Story 11 — Sélectionner un restaurant** : En tant qu’étudiant, je veux choisir un restaurant afin de consulter ses menus et commander auprès de celui-ci.

Critères d’acceptation :

- La liste affiche les restaurants actifs.
- Le choix d’un restaurant affiche son menu et ses promotions.
- Changer de restaurant vide le panier précédent.
- La commande conserve l’identifiant du restaurant sélectionné.
- **User Story 12 — Rattacher le personnel à son restaurant** : En tant qu’administrateur, je veux rattacher chaque employé et responsable à un restaurant afin de limiter son périmètre de travail.

Critères d’acceptation :

- Chaque compte du personnel est associé au restaurant concerné.
- Les requêtes serveur filtrent les données selon le restaurant autorisé.
- Un employé ne peut pas consulter les commandes ou données d’un autre restaurant.
- Les contrôles d’accès sont testés.
- **User Story 16 — Administrer les restaurants** : En tant qu’administrateur de la plateforme, je veux créer, modifier et désactiver des restaurants afin de gérer leur présence sur la plateforme.

Critères d’acceptation :

- L’administrateur peut créer, modifier et désactiver un restaurant.
- Un restaurant désactivé n’apparaît plus dans la liste proposée aux étudiants.
- L’accès à cette fonctionnalité est réservé au rôle autorisé.
- La création d’un restaurant permet de rattacher son responsable.

