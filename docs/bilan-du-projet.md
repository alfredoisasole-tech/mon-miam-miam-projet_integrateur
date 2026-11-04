# Bilan du projet Mon Miam Miam

Ce document répond au ticket « Finaliser le bilan et la documentation » (APP-96). Il résume ce qui a été livré, la qualité atteinte, ce qui n'a pas été fait et les leçons retenues.

## Ce qui a été livré

**Plateforme multi-restaurants.** Mon Miam Miam réunit plusieurs restaurants du campus. Chaque restaurant est un espace indépendant (`/r/<restaurant>/…`) avec sa charte (couleurs, police, mode, logo), son menu, son panier et ses points. La plateforme garde sa propre charte, fixe. Un compte client appartient à la plateforme : il commande dans n'importe quel restaurant et adhère à un restaurant à sa première commande.

| Rôle | Ce qu'il peut faire |
|---|---|
| Visiteur | voir les restaurants et leurs menus, s'inscrire, se connecter, accepter ou refuser les cookies |
| Client (étudiant) | commander sur place ou en livraison, payer en espèces ou par Mobile Money, suivre et annuler une commande, donner un avis, cumuler et utiliser des points, parrainer, réclamer, modifier son profil, exporter ou supprimer ses données |
| Employé | traiter les commandes, rendre un plat indisponible, voir ses statistiques de la semaine, traiter les réclamations |
| Gérant | superviser les commandes, créer les employés, voir les statistiques générales, valider les réclamations |
| Administrateur de restaurant | gérer le menu, l'équipe, les promotions, les paramètres (horaires, livraison, fidélité, charte, logo), les statistiques |
| Administrateur de la plateforme | créer, activer et désactiver les restaurants |

**Qualité.** Au 4 novembre 2026 : 402 tests automatiques du serveur et 343 du site, tous réussis ; typage et construction sans erreur ; intégration continue sur GitHub Actions (voir [ci-cd.md](ci-cd.md) et [rapport-de-tests.md](rapport-de-tests.md)). Les anomalies trouvées et corrigées sont dans [anomalies.md](anomalies.md).

**Déploiement.** Site sur Vercel, API sur Render, déploiement décrit dans [deploiement.md](deploiement.md). Les comptes d'essai sont dans [comptes-de-demonstration.md](comptes-de-demonstration.md).

**Documentation.** Architecture ([architecture.md](architecture.md)), modèle de données ([modele-de-donnees.md](modele-de-donnees.md)), règles métier ([regles-commande-paiement.md](regles-commande-paiement.md), [regles-multi-restaurants.md](regles-multi-restaurants.md), [roles-permissions.md](roles-permissions.md)), API ([api/](api/) et [api-postman.md](api-postman.md)), installation ([installation.md](installation.md)), manuels ([manuel-etudiant.md](manuel-etudiant.md), [manuel-personnel.md](manuel-personnel.md)), gestion ([plan-gestion-risques.md](plan-gestion-risques.md), [analyse-budgetaire.md](analyse-budgetaire.md), [plan-beta.md](plan-beta.md), [aspects-juridiques.md](aspects-juridiques.md)).

## Ce qui n'a pas été fait

- **Paiement réel par Easypay.** L'adaptateur est écrit et testé avec des réponses simulées, mais le bac à sable du prestataire ne fonctionne pas (voir [anomalies.md](anomalies.md)). Le paiement par Mobile Money fonctionne en **mode simulé** pour les essais et la démonstration. Décision d'équipe : arrêter l'intégration réelle ici.
- **Envoi de SMS ou d'e-mail** (mot de passe oublié) : aucun fournisseur choisi.
- **Base de données persistante** sur l'hébergement : la version gratuite recrée la base à chaque redémarrage.
- **Relecture juridique** des pages légales, **essais de charge** et **essais avec lecteur d'écran**.

## Ce qui a bien fonctionné

- Un contrat d'API écrit avant les écrans, des tests à chaque évolution et une intégration continue qui bloque les fusions cassées.
- Le découpage en petites évolutions relues avant fusion.
- Les essais dans un vrai navigateur, qui ont trouvé des défauts que les tests automatiques ne voyaient pas (voir [anomalies.md](anomalies.md)).

## Ce qui a été difficile

- **Dépendance à un prestataire externe** : l'accès de test d'Easypay a bloqué le paiement réel. Leçon : prévoir dès le départ un mode simulé complet et le valider avec le prestataire plus tôt.
- **Changement de modèle en cours de route** : le lien d'un compte à un restaurant a dû être retiré (migration de la base). Leçon : trancher plus tôt la question « un compte, plusieurs restaurants ».
- **Cohérence visuelle** : charte de la plateforme et chartes des restaurants devaient rester séparées ; cela a demandé une règle claire (la plateforme est fixe, chaque restaurant a la sienne).

## Pour aller plus loin

1. Reprendre Easypay si le prestataire rouvre l'accès, puis faire un essai réel avec un petit montant.
2. Choisir un fournisseur de SMS ou d'e-mail.
3. Passer sur une base persistante et une offre d'hébergement sans mise en veille.
4. Faire relire les pages légales et tester sur de vrais téléphones.
5. Ajouter aux cartes des restaurants leur adresse, leurs horaires et un plat du jour, comme sur la maquette.
