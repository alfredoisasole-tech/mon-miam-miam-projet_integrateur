# Intégration d'Easypay — préparation (APP-103)

Ce document prépare le remplacement du paiement mobile money **simulé** par l'API réelle d'Easypay. Il dit ce qu'il faut obtenir du fournisseur, ce qui est déjà prêt dans le projet, et dans quel ordre avancer. Le contrat actuel des paiements est dans [paiements.md](paiements.md).

- **Ticket :** [APP-103](https://judbie2030-45660043.atlassian.net/browse/APP-103) et ses sous-tâches APP-104 à APP-108.
- **Statut :** en attente de la documentation et d'un accès de test d'Easypay. **Aucune ligne de code spécifique à Easypay n'est écrite** : sans sa documentation, tout nom de champ, d'adresse ou de signature serait inventé.

## 1. Point de départ

Le projet attend la documentation d'Easypay depuis le début : l'adaptateur doit venir « après réception et validation de sa documentation » (`backend/src/domain/payments.ts`, [paiements.md](paiements.md)). Une recherche publique du 3 novembre 2026 n'a trouvé aucune documentation d'une API Easypay pour la RDC et le mobile money ; le seul Easypay documenté en ligne est un acteur portugais ([docs.easypay.pt](https://docs.easypay.pt)), qui n'est pas lié à M-Pesa, Orange Money, Airtel Money ni Africell. **Première action : confirmer avec Easypay quel produit et quelle API sont concernés.**

## 2. Ce qu'il faut obtenir d'Easypay

À demander par écrit au fournisseur, avec les accès de test (sandbox) :

| # | Question | Pourquoi (ce qui est déjà fixé chez nous) |
|---|---|---|
| 1 | Documentation officielle de l'API, version, URL de l'environnement de test et de production | Aucun appel réel n'est possible sans elle. |
| 2 | Authentification des appels du serveur vers Easypay (clé, jeton, identifiant marchand) | Les secrets seront des variables d'environnement, jamais dans le dépôt. |
| 3 | Démarrage d'un paiement : adresse, champs obligatoires, format du numéro de téléphone, devise (FC) | Nous envoyons `paymentId`, `orderId`, `amountFc` (entier), `operator`, `phone` (`+243…`). |
| 4 | Parcours côté étudiant : redirection vers une page, ou demande de confirmation envoyée sur le téléphone (USSD) ? | Notre contrat renvoie un `redirectUrl` ; il faudra peut-être l'adapter. |
| 5 | Opérateurs pris en charge : M-Pesa, Orange Money, Airtel Money, Africell Money | Ce sont les valeurs de `payments.operator`. |
| 6 | Notifications de résultat (webhook) : adresse à déclarer, format exact du corps, statuts possibles | Nous ne confirmons une commande que sur notification signée, jamais depuis le site. |
| 7 | **Méthode de signature des notifications** : algorithme, en-tête utilisé, secret, sur quels octets | Aujourd'hui : HMAC-SHA-256 hexadécimal du corps brut dans `X-Payment-Signature`. L'en-tête peut différer. |
| 8 | Le montant et la devise figurent-ils dans la notification ? | Obligatoire : nous refusons toute notification dont le montant diffère. |
| 9 | Référence du fournisseur pour chaque transaction, et clé d'idempotence éventuelle | Nous la stockons dans `payments.provider_ref`. |
| 10 | Rejeu des notifications : combien de fois, à quel rythme, avec quelle garantie d'ordre | Un rejeu identique est sans effet chez nous. |
| 11 | Expiration d'un paiement non confirmé, et possibilité de vérifier son statut par un appel | Nous considérons un paiement expiré après 15 minutes. |
| 12 | Remboursement : par API ou manuel ? | Aujourd'hui, `refund_due` signale un remboursement à traiter à la main. |
| 13 | Adresses IP d'émission des notifications (liste blanche), limites de débit, frais et plafonds par transaction | Pour la sécurité et le dimensionnement. |
| 14 | Numéros et scénarios de test par opérateur (succès, échec, expiration) | Pour dérouler le plan de la section 5. |

## 3. Ce qui est déjà prêt dans le projet

- **Point d'insertion :** l'interface `PaymentProvider` (`backend/src/domain/payments.ts`) ; `createApp` accepte un fournisseur à injecter, la simulation étant le défaut. L'adaptateur Easypay se branche à cet endroit.
- **Confirmation côté serveur uniquement :** le site ne marque jamais une commande payée ; la route `POST /api/payments/webhook` vérifie la signature sur les octets exacts du corps.
- **Montant vérifié :** une notification dont `amountFc` diffère du montant attendu est refusée (`422 AMOUNT_MISMATCH`), et un fournisseur réel doit fournir ce montant (`requiresAmountVerification`). Fait dans APP-106, indépendamment du fournisseur.
- **Rejeu et contradictions :** un rejeu identique est sans effet ; une notification contradictoire après un état final est refusée (`409`).
- **Échecs et expirations :** un paiement échoué laisse la commande `pending` et permet une nouvelle tentative ; un paiement expire après 15 minutes ; une confirmation tardive sur une commande déjà annulée passe `paymentStatus` à `refund_due`.
- **Isolation :** un paiement est lié à sa commande et à son restaurant ; un résultat d'un restaurant ne peut pas régler la commande d'un autre.

## 4. Ce qui reste à faire, dans l'ordre

1. **Obtenir la documentation et l'accès de test** (APP-104). Bloquant, dépendance externe.
2. **Mettre l'API en ligne** (APP-105) : Easypay doit joindre `POST /api/payments/webhook` en HTTPS. Dépend de la préparation du déploiement (PR #48), de l'autorisation de l'application Vercel sur le dépôt (APP-102) et de Render (voir [deploiement.md](../deploiement.md)).
3. **Implémenter l'adaptateur** (APP-107), en TDD et sans appel réseau réel dans les tests :
   - démarrage du paiement et correspondance des champs et des statuts ;
   - vérification de la signature selon la documentation d'Easypay. Le contrôleur ne lit aujourd'hui que `X-Payment-Signature` : si Easypay utilise un autre en-tête, l'interface devra recevoir les en-têtes ;
   - lecture de la notification vers `PaymentNotification`, avec `amountFc`, et déclaration de `requiresAmountVerification = true` ;
   - sélection du fournisseur par la configuration (simulation par défaut ; démarrage refusé en production si le fournisseur réel est choisi sans ses secrets) ;
   - mise à jour de [paiements.md](paiements.md) (champs, erreurs, éventuel changement du `redirectUrl`).
4. **Tester en sandbox puis activer** (APP-108), après décision sur le réglage mobile money par restaurant (le schéma ne le stocke pas encore, voir [deploiement.md](../deploiement.md)).

## 5. Plan de test en sandbox

À dérouler avec les numéros de test de chaque opérateur, sur l'API en ligne :

| Scénario | Résultat attendu |
|---|---|
| Paiement réussi | Paiement `paid`, commande `confirmed`, un seul événement `confirmed`. |
| Paiement refusé par l'opérateur | Paiement `failed`, commande `pending`, nouvelle tentative possible. |
| Étudiant qui ne valide pas (expiration) | Paiement expiré, commande annulable, pas de confirmation tardive indue. |
| Même notification reçue plusieurs fois | Aucun effet après la première. |
| Notification avec un montant différent | Refusée (`422 AMOUNT_MISMATCH`), commande inchangée. |
| Notification avec une signature fausse ou absente | Refusée (`401 INVALID_SIGNATURE`), commande inchangée. |
| Notification d'un autre paiement ou d'un autre restaurant | Aucune commande étrangère n'est modifiée. |
| Confirmation tardive après annulation | `paymentStatus: refund_due`, remboursement à traiter. |
| Coupure du service Easypay au démarrage | `502 PAYMENT_PROVIDER_UNAVAILABLE`, aucune ligne de paiement bloquée. |

## 6. Sécurité et secrets

- Aucun identifiant marchand, clé ou secret dans le dépôt : variables d'environnement uniquement, déclarées sans valeur dans `backend/.env.example`.
- Les notifications ne sont jamais crues sur parole : signature vérifiée sur les octets exacts, montant comparé, paiement retrouvé dans notre base.
- Journaux : ne jamais écrire de secret ni de numéro de téléphone complet.
- Mise en ligne réelle : décision humaine après le plan de test, avec le réglage mobile money par restaurant tranché.
