# E-4 — Maquettes et lien Figma

**Livrable graphique exporté et publié pour relecture. Approbation de la version modifiée attendue de Judbie.**

- Responsable : Emmanuel Mboyo (`emmanuelmboyo-dotcom`).
- Branche : `docs/maquettes-validees` ; ticket [APP-99](https://judbie2030-45660043.atlassian.net/browse/APP-99).
- Planning : mardi 27 octobre 2026 ; exports actualisés le 1er novembre 2026.
- [Maquettes Figma E-4 d’Emmanuel](https://www.figma.com/design/mnn8o6VMsuz24FWleKDdlm/Mon-Miam-Miam?node-id=56-5451), accessibles en lecture sans compte.
- [Source initiale de Judbie](https://www.figma.com/design/nq0KxUaeuNisAe4a6yPvBs/Mon-Miam-Miam?node-id=4-111966).
- [Contrôles et validation](validation-e4.md), [inventaire technique](inventaire-e4.json), [rapport d’export Figma](rapport-figma-e4.json), [contenu et visuels](contenu-congolais.md).

## Version et provenance

Les 32 PNG ci-dessous sont les exports directs à l’échelle 1x des cadres de travail Figma, après adaptation des plats et boissons et harmonisation en Poppins. Ils remplacent les anciens rendus du PDF fourni. La largeur est de 1 440 pixels ; les planches longues regroupent aussi des états et formulaires. Les identifiants Figma, dimensions et empreintes SHA-256 sont consignés dans l’inventaire. Les fichiers FIG/PDF initiaux restent hors du dépôt, avec leurs empreintes conservées pour la traçabilité.

Les quatre plats sont Poulet mayonnaise, Fumbwa, Riz aux haricots et Pondu. Le menu comporte trois cartes de boissons avec leurs illustrations : Coca-Cola, Fanta et Vital’O. Les anciens visuels culinaires reconnus ont été remplacés dans les cartes, miniatures et promotions. Les visuels sont des illustrations de démonstration générées par IA, conservées dans [visuels/](visuels/README.md).

## Charte et accès

| Élément | Valeur | Contrôle |
| --- | --- | --- |
| Couleur principale | `#cfbd97` | Beige conservé pour la marque et les accents |
| Couleur secondaire | `#000000` | Noir conservé dans la navigation et les textes |
| Police | Poppins | 4 701 segments contrôlés sur la page des maquettes ; aucune autre famille relevée |
| Lecture sans compte | Réussie le 1er novembre 2026 | Nouvelle fenêtre Chrome Incognito ; [capture du contrôle](test-lecture-publique.png) |

Judbie a validé la version initiale le **26 octobre 2026**, selon Emmanuel. Les changements ultérieurs sont soumis à sa relecture : cette date n’est pas présentée comme l’approbation de la version modifiée.

## Liste des écrans et planches

| Planche | Écran / planche | Public concerné | Fonction |
| --- | --- | --- | --- |
| 01 | [Accueil et restaurants](maquettes/page-01.png) | Public | Découvrir les restaurants, les promotions et le fonctionnement du service. |
| 02 | [Menu du restaurant et mini-panier](maquettes/page-02.png) | Public / étudiant | Consulter les plats et composer le panier du restaurant. |
| 03 | [Connexion](maquettes/page-03.png) | Tous les comptes | Se connecter et rejoindre son espace. |
| 04 | [Commandes du service](maquettes/page-04.png) | Employé | Lister les commandes et leurs prochaines actions. |
| 05 | [Détail de commande](maquettes/page-05.png) | Employé | Consulter les articles, la réception, le paiement et les actions de service. |
| 06 | [Disponibilité des plats](maquettes/page-06.png) | Employé | Signaler les plats disponibles ou en rupture. |
| 07 | [Réclamations des clients](maquettes/page-07.png) | Employé | Proposer une réponse à faire valider. |
| 08 | [Statistiques du service](maquettes/page-08.png) | Employé | Consulter les indicateurs et les plats les plus vendus. |
| 09 | [Inscription étudiant](maquettes/page-09.png) | Public | Créer un compte étudiant. |
| 10 | [Mot de passe oublié](maquettes/page-10.png) | Public | Demander un lien de récupération du compte. |
| 11 | [Nouveau mot de passe](maquettes/page-11.png) | Public | Définir et confirmer un nouveau mot de passe. |
| 12 | [Accueil : états complémentaires](maquettes/page-12.png) | Public | Présenter chargement, absence de promotion et autres états de l’accueil. |
| 13 | [Menu et changement de restaurant : états](maquettes/page-13.png) | Public / étudiant | Confirmer la remise à zéro du panier lors du changement de restaurant. |
| 14 | [Connexion : états complémentaires](maquettes/page-14.png) | Tous les comptes | Présenter les erreurs et les états d’attente de connexion. |
| 15 | [Supervision du service](maquettes/page-15.png) | Gérant | Consulter l’avancement des commandes du restaurant. |
| 16 | [Gestion des employés](maquettes/page-16.png) | Gérant | Créer et gérer les accès des employés. |
| 17 | [Inscription : erreurs et confirmation](maquettes/page-17.png) | Public | Corriger les champs et confirmer la création du compte. |
| 18 | [Récupération : confirmations et erreurs](maquettes/page-18.png) | Public | Présenter lien envoyé, renvoi, expiration et succès. |
| 19 | [Statistiques du restaurant](maquettes/page-19.png) | Gérant | Analyser ventes et fidélité sur une période. |
| 20 | [Validation des réponses aux réclamations](maquettes/page-20.png) | Gérant | Approuver ou rejeter les réponses proposées. |
| 21 | [Comptes et accès de l’équipe](maquettes/page-21.png) | Administrateur restaurant | Gérer les employés et gérants du restaurant. |
| 22 | [Gestion de la carte](maquettes/page-22.png) | Administrateur restaurant | Consulter et gérer les plats du menu. |
| 23 | [Ajout d’un plat](maquettes/page-23.png) | Administrateur restaurant | Renseigner les informations et la photo d’un nouveau plat. |
| 24 | [Modification d’un plat](maquettes/page-24.png) | Administrateur restaurant | Modifier les informations et la publication d’un plat. |
| 25 | [Promotions et événements](maquettes/page-25.png) | Administrateur restaurant | Gérer les affiches et leurs périodes de publication. |
| 26 | [Paramètres du restaurant](maquettes/page-26.png) | Administrateur restaurant | Renseigner les informations, horaires et règles du restaurant. |
| 27 | [Statistiques et analyses](maquettes/page-27.png) | Administrateur restaurant | Consulter les indicateurs du restaurant sur une période. |
| 28 | [Gestion des réclamations](maquettes/page-28.png) | Administrateur restaurant | Valider les propositions ou publier une réponse directe. |
| 29 | [Liste des restaurants](maquettes/page-29.png) | Administrateur plateforme | Gérer les restaurants et leur état actif ou inactif. |
| 30 | [Création du restaurant](maquettes/page-30.png) | Administrateur plateforme | Renseigner les informations du nouveau restaurant. |
| 31 | [Premier administrateur](maquettes/page-31.png) | Administrateur plateforme | Renseigner le premier administrateur et vérifier le récapitulatif. |
| 32 | [Activation et désactivation](maquettes/page-32.png) | Administrateur plateforme | Confirmer l’activation ou la désactivation d’un restaurant. |

## Aperçus

Cliquer sur une image permet de consulter la planche en détail.

### 01 - Accueil et restaurants

Découvrir les restaurants, les promotions et le fonctionnement du service.

![Accueil et restaurants](maquettes/page-01.png)

### 02 - Menu du restaurant et mini-panier

Consulter les plats et composer le panier du restaurant.

![Menu du restaurant et mini-panier](maquettes/page-02.png)

### 03 - Connexion

Se connecter et rejoindre son espace.

![Connexion](maquettes/page-03.png)

### 04 - Commandes du service

Lister les commandes et leurs prochaines actions.

![Commandes du service](maquettes/page-04.png)

### 05 - Détail de commande

Consulter les articles, la réception, le paiement et les actions de service.

![Détail de commande](maquettes/page-05.png)

### 06 - Disponibilité des plats

Signaler les plats disponibles ou en rupture.

![Disponibilité des plats](maquettes/page-06.png)

### 07 - Réclamations des clients

Proposer une réponse à faire valider.

![Réclamations des clients](maquettes/page-07.png)

### 08 - Statistiques du service

Consulter les indicateurs et les plats les plus vendus.

![Statistiques du service](maquettes/page-08.png)

### 09 - Inscription étudiant

Créer un compte étudiant.

![Inscription étudiant](maquettes/page-09.png)

### 10 - Mot de passe oublié

Demander un lien de récupération du compte.

![Mot de passe oublié](maquettes/page-10.png)

### 11 - Nouveau mot de passe

Définir et confirmer un nouveau mot de passe.

![Nouveau mot de passe](maquettes/page-11.png)

### 12 - Accueil : états complémentaires

Présenter chargement, absence de promotion et autres états de l’accueil.

![Accueil : états complémentaires](maquettes/page-12.png)

### 13 - Menu et changement de restaurant : états

Confirmer la remise à zéro du panier lors du changement de restaurant.

![Menu et changement de restaurant : états](maquettes/page-13.png)

### 14 - Connexion : états complémentaires

Présenter les erreurs et les états d’attente de connexion.

![Connexion : états complémentaires](maquettes/page-14.png)

### 15 - Supervision du service

Consulter l’avancement des commandes du restaurant.

![Supervision du service](maquettes/page-15.png)

### 16 - Gestion des employés

Créer et gérer les accès des employés.

![Gestion des employés](maquettes/page-16.png)

### 17 - Inscription : erreurs et confirmation

Corriger les champs et confirmer la création du compte.

![Inscription : erreurs et confirmation](maquettes/page-17.png)

### 18 - Récupération : confirmations et erreurs

Présenter lien envoyé, renvoi, expiration et succès.

![Récupération : confirmations et erreurs](maquettes/page-18.png)

### 19 - Statistiques du restaurant

Analyser ventes et fidélité sur une période.

![Statistiques du restaurant](maquettes/page-19.png)

### 20 - Validation des réponses aux réclamations

Approuver ou rejeter les réponses proposées.

![Validation des réponses aux réclamations](maquettes/page-20.png)

### 21 - Comptes et accès de l’équipe

Gérer les employés et gérants du restaurant.

![Comptes et accès de l’équipe](maquettes/page-21.png)

### 22 - Gestion de la carte

Consulter et gérer les plats du menu.

![Gestion de la carte](maquettes/page-22.png)

### 23 - Ajout d’un plat

Renseigner les informations et la photo d’un nouveau plat.

![Ajout d’un plat](maquettes/page-23.png)

### 24 - Modification d’un plat

Modifier les informations et la publication d’un plat.

![Modification d’un plat](maquettes/page-24.png)

### 25 - Promotions et événements

Gérer les affiches et leurs périodes de publication.

![Promotions et événements](maquettes/page-25.png)

### 26 - Paramètres du restaurant

Renseigner les informations, horaires et règles du restaurant.

![Paramètres du restaurant](maquettes/page-26.png)

### 27 - Statistiques et analyses

Consulter les indicateurs du restaurant sur une période.

![Statistiques et analyses](maquettes/page-27.png)

### 28 - Gestion des réclamations

Valider les propositions ou publier une réponse directe.

![Gestion des réclamations](maquettes/page-28.png)

### 29 - Liste des restaurants

Gérer les restaurants et leur état actif ou inactif.

![Liste des restaurants](maquettes/page-29.png)

### 30 - Création du restaurant

Renseigner les informations du nouveau restaurant.

![Création du restaurant](maquettes/page-30.png)

### 31 - Premier administrateur

Renseigner le premier administrateur et vérifier le récapitulatif.

![Premier administrateur](maquettes/page-31.png)

### 32 - Activation et désactivation

Confirmer l’activation ou la désactivation d’un restaurant.

![Activation et désactivation](maquettes/page-32.png)
