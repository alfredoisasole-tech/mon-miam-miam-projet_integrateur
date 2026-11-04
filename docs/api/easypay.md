# Intégration d'Easypay (e-COM EasyPay) — préparation (APP-103)

Ce document prépare le remplacement du paiement mobile money **simulé** par la passerelle réelle e-COM EasyPay. Il résume ce que dit sa documentation, les écarts avec notre modèle, les décisions à prendre et les étapes. Le contrat actuel des paiements est dans [paiements.md](paiements.md).

- **Ticket :** [APP-103](https://judbie2030-45660043.atlassian.net/browse/APP-103) et ses sous-tâches APP-104 à APP-108.
- **Source :** documentation publique de l'espace développeur, <https://developper.e-com-easypay.com>, lue le 3 novembre 2026. Elle affiche « dernières mises à jour : 12/10/2021 » et la version 1.3 : **à faire confirmer par e-COM SAS** avant de coder (contact@e-comsas.com, +243 822 717 230).
- **Statut (3 novembre 2026) :** parcours A retenu (section 3). L'adaptateur, la route de notification et la configuration sont écrits et testés **sans réseau réel** ; l'initialisation a été vérifiée au bac à sable avec les identifiants de l'équipe. Reste à faire : essai de bout en bout d'un paiement réussi, et mise en ligne de l'API (section 6). L'équipe indique qu'il n'y aura **pas de paiements réels**.

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

**Constats d'essais au bac à sable (3 novembre 2026), absents de la documentation :**

- L'initialisation avec `channels: [{ "channel": "MOBILE MONEY" }]` répond `{ "code": 1, "reference": "…", "provider": "e-COM SAS", "website": "…" }`. La documentation écrit `channel` dans son tableau de paramètres mais `channels` dans ses exemples : c'est **`channels`** qui fonctionne. La référence est une chaîne alphanumérique de 64 caractères (elle peut se terminer par `=`).
- Une erreur d'authentification revient en **HTTP 200** avec `{ "code": 0, "message": "This credentials parameters (token and cid) are not found" }` : il faut lire `code`, pas seulement le statut HTTP.
- La vérification de statut d'une transaction **non encore payée** répond **HTTP 500** (`{"message":"An error occured during the operation."}`), indiscernable d'une vraie panne ; une référence inconnue répond 404. Le corps peut commencer par du bruit HTML (avertissement PHP) avant le JSON.
- Le `token` de l'espace développeur est un jeton signé dont la date d'expiration affichée (avril 2026) est dépassée, et le bac à sable l'a pourtant accepté : à faire confirmer par e-COM SAS pour la production (durée de vie réelle du jeton).
- L'adresse de notification (« IPN URL (Call-back) ») se règle soi-même dans l'espace marchand ; le champ affiche en exemple une adresse avec un port et un chemin propres à leur plateforme, que nous remplaçons par celle de notre API.

## 2. Écarts avec notre modèle

| Notre modèle actuel | Easypay | Conséquence |
|---|---|---|
| Notification signée par HMAC (`X-Payment-Signature`) | Aucune signature documentée | **Ne jamais croire le corps d'une notification.** À chaque IPN, rappeler `checking-payment` avec la référence et ne confirmer que si Easypay répond `SUCCESS`. Si Easypay propose une signature, la demander et l'ajouter. |
| Montant dans la notification (`amountFc`, contrôle `AMOUNT_MISMATCH`) | Ni la notification ni la vérification de statut ne portent le montant | Le contrôle générique reste valable pour les fournisseurs qui l'annoncent, mais l'adaptateur Easypay ne déclare **pas** `requiresAmountVerification`. Le montant est fixé par notre serveur à l'initialisation ; ne jamais l'accepter d'ailleurs. |
| Quatre opérateurs : `mpesa`, `orange_money`, `airtel_money`, `africell_money` | Trois opérateurs, et **aucun paramètre d'opérateur** dans l'API | Africell n'est pas pris en charge : à retirer du choix ou à refuser. L'opérateur reste enregistré chez nous mais n'est pas transmis. |
| Montants en FC entiers | `currency` `CDF` ou `USD`, `amount` numérique | Envoyer `CDF` et le montant en FC. |
| Téléphone `+243XXXXXXXXX` | `customer_phone` sans 0 ni indicatif pays | `+243822717230` devient `822717230`. |
| Identifiant de paiement `pay_<uuid>` | `order_ref` alphanumérique | Envoyer l'identifiant sans `_` ni `-`, et retrouver le paiement par la **référence Easypay** enregistrée à l'initialisation (`payments.provider_reference`). |
| Statuts `paid` et `failed` | `SUCCESS`, `CANCELED`, `DECLINED` | `SUCCESS` devient `paid` ; `DECLINED` et `CANCELED` deviennent `failed` (nouvelle tentative possible). |
| `redirectUrl` toujours renvoyé au site | La redirection n'existe que dans le parcours « passerelle » | Voir la section 3. |

## 3. Décision à prendre : quel parcours de paiement

| | A. Passerelle avec redirection | B. Mobile Money direct |
|---|---|---|
| Fonctionnement | Le site redirige l'étudiant vers la page Easypay, qui propose carte et Mobile Money, puis le ramène sur `success_url`, `cancel_url` ou `error_url` | Easypay envoie la demande de confirmation sur le téléphone de l'étudiant, sans quitter le site |
| Contrat `paiements.md` | **Inchangé** : `redirectUrl` devient l'adresse Easypay ; le frontend déjà écrit continue de rediriger | `redirectUrl` disparaît ; le site doit afficher « confirmez sur votre téléphone » et attendre le résultat |
| Données utilisées | `operator` et `phone` saisis ne servent plus (l'étudiant les ressaisit sur la passerelle) | `phone` est utilisé, `operator` non |
| À prévoir | Trois adresses de retour vers le site (configuration de l'adresse du site) | Modification du frontend et du contrat |

**Décision (3 novembre 2026) : parcours A** (aucun changement du contrat ni du frontend). Le parcours B reste possible plus tard si l'équipe veut une expérience 100 % mobile money.

## 4. Ce qu'il reste à obtenir ou à confirmer

Fait : les identifiants du bac à sable sont fournis par l'équipe (variables d'environnement, jamais dans le dépôt) et l'initialisation fonctionne.

1. **Identifiants de production** (mode `v1`) : seulement si un jour de vrais paiements sont envisagés. L'équipe indique que non.
2. **Enregistrement de l'adresse de notification** dans l'espace marchand, une fois l'API en ligne : `https://<adresse-de-l-API>/api/payments/easypay/ipn?key=<EASYPAY_IPN_KEY>`.
3. **Essai d'un paiement réussi** de bout en bout au bac à sable : ouvrir l'adresse de redirection, payer avec la carte de test, puis vérifier que la notification arrive et que la commande passe à `confirmed`. La forme réelle d'une notification (en-têtes, type de contenu, rejeux) n'a pas pu être observée : à constater pendant cet essai.
4. À demander à e-COM SAS si le besoin se présente : signature des notifications, numéros de test Mobile Money par opérateur, durée de validité d'une transaction non confirmée, durée de vie réelle du `token`, longueur maximale de `order_ref`, prise en charge d'Africell.

## 5. Ce qui est prêt dans le projet

- **Choix du fournisseur par la configuration :** `PAYMENT_PROVIDER` (`simulation` par défaut, ou `easypay`) ; avec `easypay`, `EASYPAY_CID`, `EASYPAY_TOKEN`, `EASYPAY_IPN_KEY` et `SITE_URL` sont obligatoires (`EASYPAY_MODE` : `sandbox` par défaut, ou `v1`). Voir `backend/.env.example` et [installation.md](../installation.md).
- **Adaptateur** (`backend/src/domain/easypay.ts`) : initialisation avec redirection sur le canal Mobile Money (devise `CDF`), vérification du statut par appel direct, délai maximal de 10 secondes, aucun identifiant dans les erreurs, tolérance au bruit HTML. Testé avec un faux client HTTP, sans appel réseau réel.
- **Référence du fournisseur :** colonne `payments.provider_reference` (migration 005, unique) renseignée à l'initialisation ; une relance de la même demande rejoue la redirection sans seconde transaction chez Easypay. `payments.provider_ref` garde son sens (vide tant que rien n'est confirmé), ce qui préserve la détection des confirmations tardives.
- **Notification** : `POST /api/payments/easypay/ipn?key=…`. Son contenu n'est **jamais cru** : seule la référence est lue, puis Easypay est rappelé et sa réponse décide. Détail dans [paiements.md](paiements.md).
- **Parcours côté site :** dans le panier, le choix « Mobile Money » demande l'opérateur et le numéro ; après la création de la commande, le site appelle `POST /api/orders/:id/pay` et redirige vers la page Easypay. Au retour, Easypay renvoie vers `/orders?commande=<id>&paiement=succes|annule|erreur` : « Mes commandes » affiche le message correspondant et se rafraîchit toutes les 4 secondes tant que le paiement est en attente. Une commande en attente et non payée garde un bouton « Payer par Mobile Money » (ou « Reprendre le paiement »). Un total à 0 FC (réglé en points) ne démarre aucun paiement.
- **Fermeture des autres chemins :** avec Easypay, la route à signature HMAC et la simulation ne peuvent plus rien confirmer.
- **Contrôle du montant générique** (APP-106) : il ne s'applique pas à Easypay, qui n'annonce pas de montant ; le montant est fixé par notre serveur à l'initialisation.
- **Rejeu, échecs, expirations, isolation** : inchangés (rejeu sans effet, contradiction en `409`, paiement échoué → nouvelle tentative, expiration à 15 minutes, `refund_due` pour une confirmation tardive sur commande annulée).

## 6. Ce qui reste à faire, dans l'ordre

1. **Mettre l'API en ligne** (APP-105) : Easypay doit joindre l'adresse de notification en HTTPS. Le Blueprint `render.yaml` est préparé ; voir [deploiement.md](../deploiement.md). Variables à saisir : `PAYMENT_PROVIDER=easypay`, `EASYPAY_MODE=sandbox`, `EASYPAY_CID`, `EASYPAY_TOKEN`, `EASYPAY_IPN_KEY`, `SITE_URL`.
2. **Déclarer l'adresse de notification** dans l'espace marchand Easypay (section 4, point 2).
3. **Essai de bout en bout au bac à sable** (APP-108), avec le plan de la section 7.
4. **Corriger si besoin** l'adaptateur d'après la notification réellement reçue.

**Hébergement gratuit.** Sur l'offre gratuite de Render, le service s'endort après 15 minutes sans trafic (environ une minute pour se réveiller) et sa base est effacée à chaque redémarrage ([documentation Render](https://render.com/docs/free), lue le 3 novembre 2026). Une notification reçue après un redémarrage ne retrouverait plus son paiement. Acceptable pour des essais au bac à sable sans paiement réel, comme l'indique l'équipe.

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
