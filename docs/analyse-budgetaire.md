# Analyse budgétaire

Cette analyse est une **proposition de l'équipe projet**, comme le demande le cahier des charges. Les montants en dollars sont des **estimations à confirmer** ; ils ne viennent d'aucun devis. Les hypothèses sont écrites pour pouvoir être corrigées.

## 1. Coût de réalisation (projet scolaire)

Le projet est réalisé par 8 personnes en 4 binômes. Le travail n'est pas rémunéré ; on le chiffre quand même pour savoir ce qu'il coûterait.

| Poste | Hypothèse | Estimation |
|---|---|---|
| Développement du site et de l'API | 8 personnes × 4 semaines × 10 heures par semaine = 320 heures | à valoriser au taux horaire choisi |
| Conception, documents, tests | inclus dans les 320 heures | — |

Coût de réalisation = **320 heures × taux horaire**. Exemple, à titre d'illustration seulement : à 5 USD l'heure (hypothèse), 1 600 USD. Le taux réel est à fixer avec l'enseignant.

## 2. Coûts de fonctionnement

| Poste | Démonstration (décision du 3 novembre 2026) | Exploitation réelle |
|---|---|---|
| Hébergement de l'API (Render) | offre gratuite : 0 USD, mais base effacée à chaque redémarrage et mise en veille | formule payante avec disque persistant : de l'ordre de quelques dizaines de dollars par mois (à vérifier sur la grille de prix du fournisseur) |
| Hébergement du site (Vercel) | offre gratuite : 0 USD | offre gratuite suffisante au début, à revérifier selon le trafic |
| Nom de domaine | aucun | de l'ordre de 10 à 20 USD par an (à vérifier chez le registraire) |
| Envoi du code de mot de passe oublié (SMS ou e-mail) | non branché : 0 USD | coût par message selon le fournisseur choisi (non encore choisi) |
| Paiement mobile money | simulé : 0 USD | commission du fournisseur sur chaque paiement (taux à obtenir auprès de lui) |
| Sauvegarde de la base | aucune | stockage externe, coût faible (à chiffrer avec le choix de l'hébergeur) |

## 3. Recettes possibles

Le cahier des charges ne fixe pas de modèle économique. Pistes à discuter, sans chiffre à ce stade :

- commission sur chaque commande payée en ligne ;
- abonnement mensuel par restaurant partenaire ;
- mise en avant payante d'un événement ou d'une promotion.

## 4. Seuil de rentabilité (méthode)

Si le coût mensuel d'exploitation est **C** et que la plateforme garde une commission **p** sur le montant moyen d'une commande **M**, il faut vendre **C ÷ (p × M)** commandes par mois pour couvrir les frais. Exemple fictif : C = 40 USD, p = 3 %, M = 5 USD donnent environ 267 commandes par mois. Ces trois valeurs sont à remplacer par des valeurs réelles.

## 5. Conclusion et décisions à prendre

- Pour la **démonstration**, le coût est nul, au prix de limites connues (données non conservées, mise en veille).
- Avant d'accueillir de **vrais restaurants**, il faudra : un hébergement avec stockage durable, un fournisseur d'envoi de messages, un fournisseur de paiement et un nom de domaine.
- L'équipe doit choisir le modèle de recettes et obtenir les vrais tarifs avant de s'engager.
