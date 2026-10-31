# Contrat d'API — Authentification (APP-14)

> Story Jira : APP-14 « Inscrire et connecter un utilisateur »
> Sous-tâches : 6.1 (inscription), 6.2 (connexion/déconnexion), 6.3 (erreurs)
> Dernière mise à jour : 27 octobre 2026

> État du dépôt : inscription, connexion, profil, jetons signés et réinitialisation via un expéditeur injectable sont implémentés. Le transport e-mail/SMS doit être fourni par le déploiement via `AppOptions.sendPasswordResetCode` ; sans expéditeur, la demande répond `503 RESET_DELIVERY_UNAVAILABLE` au lieu de prétendre qu’un code a été envoyé.

## Règles transversales

- **Compte unique** : un étudiant a UN SEUL compte pour tous les restaurants.
- **E-mail et téléphone uniques** sur toute la plateforme (pas seulement par restaurant).
- **E-mail insensible à la casse** : `Alice@Exemple.com` et `alice@exemple.com` désignent le même compte.
- **Téléphone normalisé** au format `+243XXXXXXXXX` (12 chiffres après le `+`).
- **Mot de passe** : au moins 8 caractères, au moins une majuscule, au moins un chiffre.
- Les codes de réinitialisation générés font huit caractères hexadécimaux et expirent après 60 minutes.
- **Le mot de passe n'est jamais renvoyé ni journalisé**, même en cas d'erreur.
- **Déconnexion** : le site oublie le jeton côté client. Il n'y a **pas de route serveur** de déconnexion.
- **Messages d'erreur génériques** : « Identifiants incorrects » que le compte n'existe pas OU que le mot de passe soit faux (pour ne pas révéler l'existence d'un compte).
- Les mots de passe sont hachés avec `scrypt`. Les jetons signés expirent après huit heures et chaque requête vérifie encore le statut et le rôle du compte en base.
- Une réinitialisation réussie incrémente la version de sécurité du compte et invalide ses jetons existants.
- Après huit erreurs pour un compte, celui-ci est verrouillé jusqu'à une réinitialisation réussie. Les limites par adresse IP et l'envoi/réinitialisation de codes sont également limités.

---

## 1. Inscription d'un étudiant

### `POST /api/restaurants/:slug/auth/register`

**Rôles autorisés** : public (visiteur).

**Entrée (JSON)** :

```json
{
  "name": "Alice Mbuyi",
  "email": "alice@exemple.com",
  "phone": "+243815554433",
  "password": "MotDePasse1",
  "commune": "Limete",
  "quartier": "Industriel",
  "adresse": "12 avenue de la Paix",
  "referralCode": "ALICE2026",
  "acceptTerms": true
}
```

**Validation** :

| Champ | Règle |
|---|---|
| `name` | obligatoire, 2 à 80 caractères |
| `email` | obligatoire, format e-mail valide |
| `phone` | obligatoire, format `+243XXXXXXXXX` |
| `password` | obligatoire, ≥ 8 caractères, ≥ 1 majuscule, ≥ 1 chiffre |
| `commune`, `quartier`, `adresse` | facultatifs, texte libre |
| `referralCode` | facultatif, texte libre |
| `acceptTerms` | obligatoire, doit être `true` |

**Sortie (201)** :

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "usr_abc123",
    "name": "Alice Mbuyi",
    "email": "alice@exemple.com",
    "phone": "+243815554433",
    "role": "student",
    "memberships": [
      { "restaurant": "zeduc-space", "since": "2026-10-27T10:00:00Z" }
    ]
  }
}
```

**Erreurs** :

| Statut | Code | Message |
|---|---|---|
| 400 | `INVALID_BODY` | « Données invalides : [liste des champs fautifs] » |
| 404 | `RESTAURANT_NOT_FOUND` | « Restaurant introuvable ou désactivé » |
| 409 | `EMAIL_TAKEN` | « Un compte existe déjà avec cet e-mail ; connectez-vous » |
| 409 | `PHONE_TAKEN` | « Un compte existe déjà avec ce téléphone ; connectez-vous » |
| 422 | `TERMS_NOT_ACCEPTED` | « Vous devez accepter les conditions d'utilisation » |
| 429 | `TOO_MANY_ATTEMPTS` | « Trop de tentatives, réessayez dans X minutes » |

**Effet de bord** : crée l'utilisateur, crée son adhésion au restaurant `:slug`, et si `referralCode` est fourni et valide, enregistre le parrainage (récompense créditée au restaurant de la première commande qualifiante du filleul).

---

## 2. Connexion

### `POST /api/auth/login`

**Rôles autorisés** : public.

**Entrée (JSON)** :

```json
{
  "identifier": "alice@exemple.com",
  "password": "MotDePasse1"
}
```

`identifier` peut être un e-mail OU un téléphone.

**Sortie (200)** :

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "usr_abc123",
    "name": "Alice Mbuyi",
    "email": "alice@exemple.com",
    "phone": "+243815554433",
    "role": "student",
    "mustChangePassword": false
  }
}
```

**Erreurs** :

| Statut | Code | Message |
|---|---|---|
| 400 | `INVALID_BODY` | « Identifiant ou mot de passe manquant » |
| 401 | `INVALID_CREDENTIALS` | « Identifiants incorrects » (même message si compte inconnu OU mauvais mot de passe) |
| 403 | `ACCOUNT_DISABLED` | « Ce compte est désactivé » |
| 429 | `TOO_MANY_ATTEMPTS` | « Trop de tentatives, réessayez dans 15 minutes » (en-tête `Retry-After: 900`) |

**Règles de limitation** :

- **8 échecs en 15 minutes** par identifiant (e-mail ou téléphone).
- **8 échecs en 15 minutes** par adresse IP (pour couvrir le cas des réseaux partagés type campus).
- Après 8 échecs sur un compte : le compte est **suspendu** (nécessite une réinitialisation de mot de passe).

---

## 3. Profil courant

### `GET /api/me`

**Rôles autorisés** : toute personne connectée (étudiant, employé, gérant, admin, platform_admin).

**En-tête** : `Authorization: Bearer <token>`

**Sortie (200)** : même structure que `user` dans la réponse de `/login`.

**Erreurs** :

| Statut | Code | Message |
|---|---|---|
| 401 | `UNAUTHORIZED` | « Connexion requise » |
| 403 | `ACCOUNT_DISABLED` | « Ce compte est désactivé » |

---

## 4. Demande de réinitialisation de mot de passe

### `POST /api/auth/forgot-password`

**Rôles autorisés** : public.

**Entrée (JSON)** :

```json
{
  "identifier": "alice@exemple.com"
}
```

**Sortie (202)** :

```json
{
  "message": "Si ce compte existe, un code de réinitialisation a été envoyé."
}
```

**⚠️ Règle de sécurité** : la réponse est **identique que le compte existe ou non** (pour ne pas révéler l'existence d'un compte).

**Effet de bord** : si le compte existe, un code à usage unique est généré (valable **60 minutes**) et envoyé par le canal enregistré (e-mail ou téléphone).

---

## 5. Réinitialisation du mot de passe

### `POST /api/auth/reset-password`

**Rôles autorisés** : public.

**Entrée (JSON)** :

```json
{
  "identifier": "alice@exemple.com",
  "code": "A1B2C3D4",
  "newPassword": "NouveauMot1"
}
```

**Sortie (200)** :

```json
{
  "message": "Mot de passe réinitialisé. Vous pouvez vous connecter."
}
```

**Erreurs** :

| Statut | Code | Message |
|---|---|---|
| 400 | `INVALID_BODY` | « Données invalides » |
| 422 | `INVALID_CODE` | « Code invalide ou expiré » |
| 422 | `WEAK_PASSWORD` | « Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre » |

**Règle** : le code est à **usage unique**. Après utilisation (réussie ou échouée sur un mauvais mot de passe), il est invalidé.

---

## État des tests

Les tests d'API se trouvent dans `backend/tests/auth-api.test.ts`. Les tests des 16 cas listés ci-dessous restent à compléter :

1. **Inscription réussie** → 201, token et user renvoyés, adhésion créée.
2. **Inscription avec e-mail déjà pris** → 409 `EMAIL_TAKEN`.
3. **Inscription avec téléphone déjà pris** → 409 `PHONE_TAKEN`.
4. **Inscription avec mot de passe faible** (pas de majuscule) → 400 avec message en français.
5. **Inscription avec restaurant inconnu** → 404 `RESTAURANT_NOT_FOUND`.
6. **Inscription sans accepter les conditions** → 422 `TERMS_NOT_ACCEPTED`.
7. **Connexion réussie par e-mail** → 200, token et user.
8. **Connexion réussie par téléphone** → 200, token et user.
9. **Connexion avec mauvais mot de passe** → 401 `INVALID_CREDENTIALS` (message générique).
10. **Connexion avec compte inexistant** → 401 `INVALID_CREDENTIALS` (même message).
11. **Connexion avec compte désactivé** → 403 `ACCOUNT_DISABLED`.
12. **8 échecs de connexion en 15 minutes sur le même compte** → 429 `TOO_MANY_ATTEMPTS`.
13. **8 échecs de connexion en 15 minutes depuis la même IP** → 429 `TOO_MANY_ATTEMPTS`.
14. **Demande de réinitialisation** → 202 dans tous les cas (compte existant ou non).
15. **Réinitialisation avec code expiré** → 422 `INVALID_CODE`.
16. **Réinitialisation avec code déjà utilisé** → 422 `INVALID_CODE`.