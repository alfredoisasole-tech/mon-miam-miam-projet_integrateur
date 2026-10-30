# E-4 - Maquettes et lien Figma

**État : version source documentée ; adaptation des menus congolais, conformité typographique et date de validation à finaliser.**

- Responsable : Emmanuel Mboyo (`emmanuelmboyo-dotcom`).
- Branche : `docs/maquettes-validees`.
- Planning : mardi 27 octobre 2026 ; préparation réelle le 30 octobre 2026.
- [Ouvrir le fichier Figma confirmé par Emmanuel](https://www.figma.com/design/nq0KxUaeuNisAe4a6yPvBs/Mon-Miam-Miam?node-id=4-111966).
- [Inventaire technique des 32 exports](inventaire-e4.json).
- [Contrôles, validation et points restant à confirmer](validation-e4.md).
- [Contenu congolais demandé pour la prochaine version](contenu-congolais.md).

Le lien Figma a été ouvert sans connexion dans une fenêtre Chrome en navigation privée le 30 octobre 2026. Les maquettes étaient accessibles ; l’inscription était proposée pour commenter, modifier ou inspecter.

## Sources et portée

Les 32 images ci-dessous sont des rendus directs des 32 pages du PDF `Mon Miam Miam.pdf` fourni avec le fichier `Mon Miam Miam.fig`. Le PDF indique Figma comme producteur et une date de création au 29 octobre 2026. Les images conservent les écrans, données d’exemple et états de la source ; elles ne constituent pas une correction de ses règles métier.

Ces exports représentent la version fournie avant la demande de remplacement des plats et boissons. Ils devront être remplacés par les exports de la version modifiée avant de déclarer E-4 terminée.

La largeur native est de 1 440 pixels et la hauteur varie selon la page. Les planches longues incluent souvent plusieurs états : une page du PDF ne correspond donc pas toujours à un écran unique. Les aperçus ne sont pas annoncés comme des exports Figma 2x. Les fichiers source volumineux restent hors du dépôt ; leurs empreintes figurent dans l’inventaire.

## Charte attendue

| Élément | Valeur | Usage |
| --- | --- | --- |
| Couleur principale | `#cfbd97` | Boutons, accents et éléments de marque |
| Couleur secondaire | `#000000` | Texte principal et navigation sombre |
| Police | Poppins | Titres, corps, formulaires, boutons et tableaux |

Les couleurs demandées sont présentes dans le PDF. Le fichier FIG fourni contient des références à Poppins et à Inter : la présence de Poppins seule ne prouve pas que tous les textes l’utilisent. La conformité typographique complète doit être vérifiée et, si nécessaire, corrigée dans le fichier Figma avant de clôturer E-4.

## Liste des écrans et planches

| Page PDF | Écran / planche | Public concerné | Fonction |
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
