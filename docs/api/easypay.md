# Intégration d'Easypay (e-COM EasyPay) — préparation (APP-103)

Ce document prépare le remplacement du paiement mobile money **simulé** par la passerelle réelle e-COM EasyPay. Il résume ce que dit sa documentation, les écarts avec notre modèle, les décisions à prendre et les étapes. Le contrat actuel des paiements est dans [paiements.md](paiements.md).

- **Ticket :** [APP-103](https://judbie2030-45660043.atlassian.net/browse/APP-103) et ses sous-tâches APP-104 à APP-108.
- **Source :** documentation publique de l'espace développeur, <https://developper.e-com-easypay.com>, lue le 3 novembre 2026. Elle affiche « dernières mises à jour : 12/10/2021 » et la version 1.3 : **à faire confirmer par e-COM SAS** avant de coder (contact@e-comsas.com, +243 822 717 230).
- **Statut :** aucun code spécifique à Easypay n'est encore écrit. Le choix de parcours de la section 3 et les accès de test (section 4) sont requis.

## 1. Ce que dit la documentation

**Service.** Passerelle de paiement d'e-COM SAS (Kinshasa) : cartes Visa et Mastercard, carte locale PROCARD d'EquityBCDC, et **Mobile Money Airtel Money, Orange Money et Vodacom M-Pesa**. Africell n'est pas cité.

**Adresses et accès.** Toutes les adresses suivent `https://www.e-com-easypay.com/{MODE}/…`, avec `MODE` valant `sandbox` (développement) ou `v1` (production). Les appels du marchand s'authentifient par deux paramètres dans l'adresse, `cid` (identifiant de corrélation) et `token` (clé publique), disponibles dans le menu « Espace Développeur » de l'espace marchand <https://merchant.e-com-easypay.com>.

| API | Appel | Données | Réponse |
|---|---|---|---|
| Initialiser une transaction (avec redirection) | `POST /{MODE}/payment/initialization?cid=…&token=…` | `order_ref` (alphanumérique), `currency` (`CDF` ou `USD`), `amount`, `customer_name`, `description`, `channel`/`channels` (`CREDIT CARD`, `MOBILE MONEY`), `success_url`, `cancel_url`, `error_url`, facultatifs : `customer_email`, `language` (`FR`, `EN`) | `{ "code": 1, "reference": "…" }` ; si `code` vaut 0, `message` décrit l'échec |
| Rediriger le client | `GET /{MODE}/payment/initialization?reference=…` | la `reference` reçue | page de paiement Easypay |
| Mobile Money sans redirection | `POST /{MODE}/mobile-money/payment?cid=…&token=…` | `order_ref`, `currency`, `amount`, `customer_phone` (**sans 0 ni indicatif pays**, par exemple `822717230`), `customer_name`, `description`, facultatif `customer_email` ; le client reçoit une demande de confirmation sur son téléphone | `{ "code": 1, "reference": "…" }` |
| Vérifier le statut | `POST /{MODE}/payment/{reference}/checking-payment` | la `reference` | `200` : `{ "transaction": { "order_ref", "reference" }, "payment": { "channel", "status", "reference" } }` ; `404` si inconnue ; `500` en cas d'erreur |

`payment.status` vaut `SUCCESS` (effectuée), `CANCELED` (annulée) ou `DECLINED` (échouée).

**Notification (IPN).** Easypay envoie en `POST` à l'adresse d'IPN que le marchand a **fournie à e-COM SAS** un objet JSON du même format que la vérification de statut (`transaction`, `payment`). La documentation ne mentionne **ni signature, ni en-tête d'authentification, ni montant** dans cette notification, ni de règle de rejeu.

**Bac à sable.** La page <https://e-com-easypay.com/sandbox/payment/test> indique, pour un paiement de test de 1 USD par carte : numéro `4111 1111 1111 1111`, expiration `01/2027`, CVV `111`. Aucun numéro de test Mobile Money n'est documenté.

## 2. Écarts avec notre modèle

| Notre modèle actuel | Easypay | Conséquence |
|---|---|---|
| Notification signée par HMAC (`X-Payment-Signature`) | Aucune signature documentée | **Ne jamais croire le corps d'une notification.** À chaque IPN, rappeler `checking-payment` avec la référence et ne confirmer que si Easypay répond `SUCCESS`. Si Easypay propose une signature, la demander et l'ajouter. |
| Montant dans la notification (`amountFc`, contrôle `AMOUNT_MISMATCH`) | Ni la notification ni la vérification de statut ne portent le montant | Le contrôle générique reste valable pour les fournisseurs qui l'annoncent, mais l'adaptateur Easypay ne déclare **pas** `requiresAmountVerification`. Le montant est fixé par notre serveur à l'initialisation ; ne jamais l'accepter d'ailleurs. |
| Quatre opérateurs : `mpesa`, `orange_money`, `airtel_money`, `africell_money` | Trois opérateurs, et **aucun paramètre d'opérateur** dans l'API | Africell n'est pas pris en charge : à retirer du choix ou à refuser. L'opérateur reste enregistré chez nous mais n'est pas transmis. |
| Montants en FC entiers | `currency` `CDF` ou `USD`, `amount` numérique | Envoyer `CDF` et le montant en FC. |
| Téléphone `+243XXXXXXXXX` | `customer_phone` sans 0 ni indicatif pays | `+243822717230` devient `822717230`. |
| Identifiant de paiement `pay_<uuid>` | `order_ref` alphanumérique | Envoyer l'identifiant sans `_` ni `-`, et retrouver le paiement par la **référence Easypay** enregistrée à l'initialisation (`payments.provider_ref`). |
| Statuts `paid` et `failed` | `SUCCESS`, `CANCELED`, `DECLINED` | `SUCCESS` devient `paid` ; `DECLINED` et `CANCELED` deviennent `failed` (nouvelle tentative possible). |
| `redirectUrl` toujours renvoyé au site | La redirection n'existe que dans le parcours « passerelle » | Voir la section 3. |

## 3. Décision à prendre : quel parcours de paiement

| | A. Passerelle avec redirection | B. Mobile Money direct |
|---|---|---|
| Fonctionnement | Le site redirige l'étudiant vers la page Easypay, qui propose carte et Mobile Money, puis le ramène sur `success_url`, `cancel_url` ou `error_url` | Easypay envoie la demande de confirmation sur le téléphone de l'étudiant, sans quitter le site |
| Contrat `paiements.md` | **Inchangé** : `redirectUrl` devient l'adresse Easypay ; le frontend déjà écrit continue de rediriger | `redirectUrl` disparaît ; le site doit afficher « confirmez sur votre téléphone » et attendre le résultat |
| Données utilisées | `operator` et `phone` saisis ne servent plus (l'étudiant les ressaisit sur la passerelle) | `phone` est utilisé, `operator` non |
| À prévoir | Trois adresses de retour vers le site (configuration de l'adresse du site) | Modification du frontend et du contrat |

**Recommandation : A pour commencer** (aucun changement du contrat ni du frontend), B ensuite si l'équipe veut une expérience 100 % mobile money. À trancher avant d'écrire l'adaptateur.

## 4. Ce qu'il reste à obtenir

1. **Identifiants du bac à sable** (`cid` et `token`, mode `sandbox`) puis de production (`v1`), depuis l'espace marchand. Variables d'environnement prévues : `EASYPAY_MODE`, `EASYPAY_CID`, `EASYPAY_TOKEN`. Le `token` passe dans l'adresse des appels : ne jamais écrire une adresse complète dans les journaux.
2. **Enregistrement de l'adresse d'IPN** auprès d'e-COM SAS : comment la déclarer, y a-t-il une authentification ou une liste d'adresses IP d'émission, et quels rejeux.
3. **Confirmation de la documentation à jour** (affichée de 2021), et existence éventuelle d'une signature des notifications.
4. **Numéros de test Mobile Money** par opérateur, et comportement du bac à sable.
5. Durée de validité d'une transaction non confirmée, `order_ref` : longueur maximale et unicité exigée, frais et plafonds par transaction, Africell.
6. L'appel `checking-payment` est-il authentifié ? La documentation ne mentionne ni `cid` ni `token` pour lui.

## 5. Ce qui est déjà prêt dans le projet

- **Point d'insertion :** l'interface `PaymentProvider` (`backend/src/domain/payments.ts`) ; `createApp` accepte un fournisseur à injecter, la simulation étant le défaut. Il faudra l'adapter : aujourd'hui `verifyNotification` est synchrone et suppose une signature, alors que la confirmation d'Easypay exige un appel réseau.
- **Confirmation côté serveur uniquement :** le site ne marque jamais une commande payée.
- **Contrôle du montant générique** (APP-106) : une notification dont `amountFc` diffère du montant attendu est refusée (`422 AMOUNT_MISMATCH`). Il ne s'applique pas à Easypay, qui n'annonce pas de montant.
- **Rejeu et contradictions :** un rejeu identique est sans effet ; une notification contradictoire après un état final est refusée (`409`).
- **Échecs et expirations :** un paiement échoué laisse la commande `pending` et permet une nouvelle tentative ; un paiement expire après 15 minutes ; une confirmation tardive sur une commande déjà annulée passe `paymentStatus` à `refund_due`.
- **Isolation :** un paiement est lié à sa commande et à son restaurant.

## 6. Ce qui reste à faire, dans l'ordre

1. **Accès de test et choix du parcours** (APP-104, section 3 et 4). Bloquant.
2. **API en ligne** (APP-105) : Easypay doit joindre l'adresse d'IPN en HTTPS. Voir [deploiement.md](../deploiement.md).
3. **Adaptateur** (APP-107), en TDD avec un client HTTP simulé, sans appel réseau réel dans les tests :
   - initialisation du paiement selon le parcours choisi, avec les conversions de la section 2 ;
   - route de réception de l'IPN, qui retrouve le paiement par la référence Easypay, **rappelle `checking-payment`** et ne confirme que sur `SUCCESS` ;
   - mise à jour de [paiements.md](paiements.md) ;
   - sélection du fournisseur par la configuration (simulation par défaut ; démarrage refusé en production si Easypay est choisi sans `EASYPAY_CID` et `EASYPAY_TOKEN`).
4. **Essais en bac à sable puis activation** (APP-108).

**Hébergement gratuit.** Sur l'offre gratuite de Render, le service s'endort après 15 minutes sans trafic (environ une minute pour se réveiller) et sa base est effacée à chaque redémarrage ([documentation Render](https://render.com/docs/free), lue le 3 novembre 2026). Un paiement initialisé puis une notification reçue après un redémarrage ne retrouveraient plus leur paiement. Convient pour essayer le bac à sable, **pas pour de vrais paiements**.

## 7. Plan de test en bac à sable

| Scénario | Résultat attendu |
|---|---|
| Paiement réussi (`SUCCESS`) | Paiement `paid`, commande `confirmed`, un seul événement `confirmed`. |
| Paiement refusé (`DECLINED`) ou annulé (`CANCELED`) | Paiement `failed`, commande `pending`, nouvelle tentative possible. |
| Notification réussie **forgée** (la vérification de statut ne répond pas `SUCCESS`) | Refusée, commande inchangée. |
| Notification pour une référence inconnue | Aucune commande modifiée. |
| Même notification reçue plusieurs fois | Aucun effet après la première. |
| Étudiant qui ne confirme pas | Paiement expiré, commande annulable. |
| Confirmation tardive après annulation | `paymentStatus: refund_due`, remboursement à traiter. |
| Easypay injoignable au démarrage ou à la vérification | `502 PAYMENT_PROVIDER_UNAVAILABLE`, aucune ligne de paiement bloquée, rien n'est confirmé. |

## 8. Sécurité et secrets

- Aucun `cid`, `token` ni secret dans le dépôt : variables d'environnement uniquement, déclarées sans valeur dans `backend/.env.example`.
- Aucune notification n'est crue sur parole : le paiement est retrouvé dans notre base, puis confirmé par un appel direct à Easypay.
- Journaux : jamais d'adresse Easypay complète (elle contient le `token`), ni de numéro de téléphone complet.
- Mise en ligne réelle : décision humaine après le plan de test, sur un hébergement qui conserve sa base.
