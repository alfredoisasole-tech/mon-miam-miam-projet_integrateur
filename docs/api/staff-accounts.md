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

Entrée : `{ "status": "inactive" }`. Une cible d’un autre restaurant ou introuvable répond `404 STAFF_ACCOUNT_NOT_FOUND`. Le changement révoque aussi les jetons existants; une personne désactivée ne peut plus utiliser son ancien jeton.

Un gérant ne peut ni créer un administrateur ni désactiver un compte. Aucun champ de restaurant fourni par le client n’est accepté pour déterminer le périmètre.
