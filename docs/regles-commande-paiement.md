# Règles de commande et de paiement

Ce document décrit les règles métier applicables aux commandes et aux paiements
dans l'application Mon Miam Miam. Il sert de référence au backend (Don), au
frontend (Gloirenk17) et à l'interface de paiement (bryanbolia).

## 1. Commande

Une commande peut être passée de deux manières :

- **Sur place** : l'étudiant indique une heure d'arrivée prévue (facultative,
  au plus 12 h à l'avance, dans les horaires d'ouverture du restaurant).
- **En livraison** : l'étudiant précise la commune de Kinshasa (parmi les 24
  communes reconnues, sans accent) et un repère connu ou une adresse complète.
  Le téléphone de livraison est celui du compte par défaut.

**Règle fondamentale du panier** : un panier ne contient que les plats d'un
**seul restaurant**. Si l'étudiant change de restaurant, le panier est vidé
(avec confirmation).

Les étapes d'une commande sont :
`en attente → confirmée → en préparation → prête → (en livraison) → terminée`.

## 2. Prix

Le navigateur n'a **jamais** le droit de décider d'un prix. Les prix affichés
sont indicatifs : le serveur recalcule systématiquement le total à partir de
sa propre base de données au moment de la validation de la commande. Cela
empêche toute falsification côté client (modification du JSON, requête
forgée, etc.).

Les montants sont toujours exprimés en **FC (francs congolais), en entiers**,
jamais en décimales.

## 3. Paiement

Deux moyens de paiement sont proposés :

- **Espèces** : payées à la remise (sur place) ou au livreur.
- **En ligne** : par redirection vers une page de paiement **simulée** pour
  l'instant (aucun agrégateur réel n'est branché).

Une commande n'est considérée **« payée »** qu'après confirmation par le
serveur (réception d'un webhook signé pour le paiement en ligne, ou
validation manuelle pour les espèces). Le frontend ne doit jamais marquer
une commande comme payée de son propre chef.

## 4. Annulation

L'étudiant peut annuler sa commande **tant qu'elle est au statut « en attente »
et qu'elle n'a pas été payée en ligne**. Dès que la commande est confirmée,
préparée ou payée en ligne, seule le personnel du restaurant peut l'annuler.

En cas d'annulation d'une commande payée en ligne, la commande passe en
statut « remboursement dû » (visible du personnel) : le remboursement
effectif reste une opération manuelle chez l'opérateur.

Un en-tête `Idempotency-Key` est envoyé par le frontend à la création de la
commande pour éviter qu'un double envoi (coupure réseau) ne crée deux
commandes identiques.

## 5. Points de fidélité

Le programme de fidélité fonctionne **par restaurant** : les points gagnés
dans un restaurant ne sont utilisables que dans ce même restaurant.

- **Gain** : 3 000 FC dépensés (sur les plats, hors livraison) = 1 point.
  Le reste est reporté (ex. : 2 000 FC aujourd'hui + 2 000 FC demain =
  1 point et 1 000 FC reportés).
- **Utilisation** : 15 points = 3 000 FC de réduction sur une commande,
  appliquée uniquement sur les plats (jamais sur la livraison).
- **Validité** : les points expirent 12 mois après leur gain.
- **Crédit** : les points sont crédités uniquement quand la commande passe
  au statut « terminée » (servie). Une commande annulée ne rapporte rien,
  et les points utilisés sur une commande annulée sont rendus.

## 6. Parrainage (hors périmètre immédiat, à ajouter plus tard)

Chaque étudiant dispose d'un code de parrainage global (valable dans tous
les restaurants). La récompense est créditée dans le restaurant de la
première commande qualifiante du filleul (base ≥ 3 000 FC), au prorata
(base ÷ 3 000, arrondi à l'entier inférieur).