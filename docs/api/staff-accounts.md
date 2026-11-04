# Contrat d’API — comptes du personnel (L-10)

Toutes les routes nécessitent un jeton Bearer valide. Le restaurant est toujours déterminé à partir du compte authentifié.

## `GET /api/staff/accounts`

**Rôles autorisés :** gérant et administrateur du restaurant.

Renvoie les comptes du personnel de ce restaurant avec leur nom, e-mail, téléphone, rôle, état, indication de changement obligatoire du mot de passe et date de création. Les empreintes de mot de passe et les mots de passe temporaires ne sont jamais renvoyés.

## `POST /api/staff/accounts`

**Rôles autorisés :** gérant et administrateur du restaurant.

Entrée : `{ "name", "email", "phone", "role" }`. Le rôle peut être `employee`; seul un administrateur peut aussi créer un `manager`. Aucun compte étudiant ou administrateur ne peut être créé par cette route. L’e-mail et le téléphone sont uniques sur la plateforme.

La réponse `201` comprend le compte créé et `temporaryPassword`. Ce mot de passe aléatoire n’est révélé que dans cette réponse; seule son empreinte est conservée. `mustChangePassword` vaut `true`.

## `PATCH /api/staff/accounts/:id`

**Rôle autorisé :** administrateur du restaurant.

Deux formes de corps, jamais mélangées :

- **État :** `{ "status": "inactive" }` désactive le compte, `{ "status": "active" }` le réactive. L’opération est idempotente. Elle révoque les jetons existants : une personne désactivée ne peut plus utiliser son ancien jeton, et une réactivation ne ressuscite pas l’ancienne session.
- **Informations :** au moins un champ parmi `name` (2 à 80 caractères), `phone` (normalisé en `+243XXXXXXXXX`, unique sur la plateforme) et `role` (`employee` ou `manager`). L’e-mail est l’identifiant de connexion et ne change pas ; aucun autre champ n’est accepté (`400 INVALID_BODY`). Un téléphone déjà pris répond `409 ACCOUNT_TAKEN`. Changer le **rôle** ou le **téléphone** révoque les jetons (la personne doit se reconnecter) ; un simple changement de nom garde la session.

Réponse `200` : `{ "account": { id, name, email, phone, role, status, mustChangePassword, createdAt } }` (pour un changement d’état, `{ id, status, account }`).

Un administrateur ne peut changer ni son propre rôle ni son propre état, et le rôle d’un autre administrateur ne se modifie pas ici (`400`). Une cible d’un autre restaurant, qui n’est pas un compte du personnel ou introuvable répond `404 STAFF_ACCOUNT_NOT_FOUND`.

Un gérant ne peut ni créer un administrateur, ni modifier, désactiver ou réactiver un compte. Aucun champ de restaurant fourni par le client n’est accepté pour déterminer le périmètre.
