# Contrat d’API — réclamations

Les routes nécessitent un jeton Bearer. Un étudiant ne peut agir que sur ses propres réclamations. Le personnel ne voit et ne traite que celles du restaurant présent dans son jeton; aucun paramètre `restaurantId` fourni par le client ne change ce périmètre.

## Étudiant

### `POST /api/claims`

**Rôle :** étudiant.

Entrée : `{ "restaurant", "kind", "orderId?", "subject", "message", "requestedPoints?" }`. Le restaurant doit être actif et l’étudiant doit y être adhérent. Une commande indiquée doit appartenir à cet étudiant et à ce restaurant. Le sujet contient 3 à 100 caractères, le message 10 à 1 000 caractères. Une réclamation de points peut préciser un nombre demandé strictement positif. Cinq réclamations non traitées au maximum sont autorisées par étudiant.

### `GET /api/claims` et `GET /api/claims/:id`

**Rôle :** étudiant.

La liste contient uniquement les réclamations de l’étudiant connecté. L’accès à l’identifiant d’un autre étudiant renvoie `404`. La proposition du personnel est masquée tant que la réclamation n’est pas traitée ; les états sont présentés comme « ouverte », « en cours d’examen » et « traitée ».

## Personnel du restaurant

### `GET /api/staff/claims?status=open|pending_validation|resolved`

**Rôles :** employé, gérant, administrateur du restaurant.

Sans `status`, toutes les réclamations de ce restaurant sont listées. Le filtre et l’isolation sont appliqués côté serveur à partir du restaurant du jeton.

### `GET /api/staff/claims/:id`

Renvoie les détails et le nom/téléphone de l’étudiant uniquement si la réclamation appartient au restaurant du jeton. Une réclamation d’un autre restaurant renvoie `404`.

### `POST /api/staff/claims/:id/propose`

**Rôles :** employé, gérant, administrateur du restaurant.

Entrée : `{ "decision": "accept" | "refuse", "response" }`, avec une réponse de 5 à 500 caractères. La réclamation passe à `pending_validation`. L’identifiant est toujours combiné au restaurant du jeton lors de la mise à jour.

### `POST /api/staff/claims/:id/validate`

**Rôles :** gérant ou administrateur du restaurant. Pour une réclamation de points, seul l’administrateur peut valider; entrée `{ "pointsGranted": number }` obligatoire si la proposition est acceptée. Le nombre accordé doit être positif et ne pas dépasser le nombre demandé. Le crédit et le passage à `resolved` sont exécutés dans une seule transaction, ce qui évite un double crédit.

### `POST /api/staff/claims/:id/reject`

**Rôles :** gérant ou administrateur du restaurant.

Entrée : `{ "note" }`, avec une note de 5 à 500 caractères. La réclamation retourne à `open` pour une nouvelle proposition. Un identifiant d’un autre restaurant renvoie `404`.
