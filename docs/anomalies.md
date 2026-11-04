# Journal des anomalies

Ce document répond au ticket « Corriger et documenter les anomalies » (APP-87). Il liste les anomalies trouvées pendant les essais dans un vrai navigateur, leur cause, leur correction et la façon de les vérifier. Les anomalies encore ouvertes sont en fin de document.

| N° | Où | Symptôme | Cause | Correction | Vérification |
|---|---|---|---|---|---|
| 1 | Fidélité (site) | Le solde et les montants s'affichaient « NaN FC ». | L'écran lisait des champs que l'API ne renvoie pas (noms différents). | L'écran utilise le format réel de l'API de fidélité. | `loyalty` ; correction `69764c6` ; essai manuel avec le compte de démonstration |
| 2 | Inscription | Un numéro écrit avec le zéro initial (`0990001111`) était refusé. | Le site envoyait le numéro tel quel, l'API attend `+243…`. | Le numéro est normalisé en `+243990001111` avant l'envoi (formes acceptées : `0…`, `99…`, `243…`, `00243…`, `+243…`). | `ux-navigation` (numéros de téléphone) |
| 3 | Tableaux, mode sombre | Texte illisible dans les tableaux d'un restaurant en mode sombre. | Couleurs de tableau fixées pour le mode clair. | Tableaux colorés par les variables de thème. | correction `5476e3e` ; essai manuel |
| 4 | Connexion | Le bouton principal prenait un style différent de celui du reste du site. | Une règle `.btn-primary` de la page de connexion s'appliquait à tout le site. | Règle supprimée ; le bouton principal est défini une seule fois dans la charte commune. | correction `5476e3e` ; revue de la feuille de style, essai manuel |
| 5 | Plateforme (intégration continue) | La page d'administration de la plateforme plantait dans les tests de l'intégration continue. | La simulation de `fetch` des tests ne renvoyait pas le format attendu. | Simulation corrigée dans le test. | `admin-pages` |
| 6 | Panier | Le panier suivait le client d'un restaurant à l'autre. | Un seul panier pour toute la plateforme. | Un panier par restaurant, conservé tel quel quand on change de restaurant ; l'ancien panier est repris sous son restaurant. | `useCart`, `ux-navigation`, `layout` |
| 7 | Compte | Un compte était lié à un « restaurant d'origine », ce qui n'avait pas de sens pour commander ailleurs. | Choix de départ du modèle de données. | Un compte client appartient à la plateforme ; l'adhésion à un restaurant se crée à la première commande ; migration `006`. | `database` (migration d'une base existante), `adhesion-premiere-commande`, `auth-api` |
| 8 | Menu | Impossible de savoir ce qu'on avait déjà pris sans ouvrir le panier. | Aucun résumé du panier sur le menu. | Barre de résumé (nombre d'articles, total, détail), quantité déjà prise sur chaque plat, compteur dans l'en-tête. | `menu-panier`, `ux-navigation` |
| 9 | Paiement par carte | La page de la passerelle de carte répondait « 403 ». | Refus de la passerelle de carte du prestataire, même sur sa propre page de test. | Option de carte retirée : le paiement en ligne se fait par Mobile Money seulement, ce qui correspond aussi au public étudiant. | essai manuel |
| 10 | Notification Easypay | L'adresse de notification était rejetée par la plateforme du prestataire. | Clé contenant des caractères spéciaux (le signe `=`). | Clé simple, vérifiée côté serveur ; le contenu de la notification n'est jamais cru, le paiement est revérifié auprès du prestataire. | `payments-easypay-ipn` |
| 11 | Compte du personnel | Un compte du personnel ne pouvait être ni modifié ni réactivé, ni recevoir un nouveau mot de passe s'il l'avait oublié. | Fonctions absentes. | Modification, réactivation et réinitialisation du mot de passe temporaire. | `staff-accounts-api`, `admin-pages` |
| 12 | Profil | Impossible de modifier son nom, son téléphone ou son adresse de livraison. | Fonction absente. | Écran « Mes informations » (`PATCH /api/me`), adresse préremplie dans le panier. | `profil-modification`, `account-pages`, `cart-page` |

## Anomalies ouvertes et limites connues

| Sujet | État | Raison |
|---|---|---|
| Paiement Easypay réel | **Arrêté** | Le bac à sable du prestataire est inutilisable : la passerelle de carte répond « 403 » et le Mobile Money attend un vrai téléphone. Aucune notification n'a jamais pu être reçue. La démonstration utilise le **paiement simulé** (page « Paiement Mobile Money (simulation) »). À reprendre seulement si le prestataire (e-COM SAS) débloque l'accès. |
| Mot de passe oublié | Limite | Aucun service d'envoi de SMS ou d'e-mail n'est branché : hors production le code est écrit dans les journaux du serveur, en production la demande répond 503. Le personnel dispose d'une voie de secours (mot de passe temporaire donné par l'administrateur). |
| Base de données de l'hébergement gratuit | Limite | La base est recréée à chaque redémarrage du serveur d'essai ; les données de démonstration sont rejouées. À remplacer par une base persistante pour une vraie ouverture. |
| Pages légales | À faire relire | Rédigées par l'équipe, pas relues par un juriste. |
| Mise en page sur téléphone | À vérifier à la main | Les tests tournent dans un navigateur simulé (voir [plan-beta.md](plan-beta.md)). |
