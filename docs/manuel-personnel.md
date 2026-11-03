# Guide du personnel — Mon Miam Miam

Version du **3 novembre 2026**. Responsable : Emmanuel Mboyo. Travail E-9, rattaché à [APP-96 — Finaliser le bilan et la documentation](https://judbie2030-45660043.atlassian.net/browse/APP-96).

Ce guide concerne l’employé, le gérant et l’administrateur d’un restaurant. L’administrateur de la plateforme possède un rôle distinct. Chaque compte du personnel intervient uniquement dans le restaurant auquel il est rattaché.

## 1. Ce qui est disponible aujourd’hui

L’état ci-dessous correspond au code de `dev`, commit `15e2918`. Un lien affiché dans le menu ne signifie pas toujours que sa page est déjà disponible.

| Fonction | Personnes concernées | État dans l’application |
| --- | --- | --- |
| Connexion et déconnexion | Tout le personnel | Disponibles |
| Bilan du restaurant : jour, semaine, mois | Gérant et administrateur du restaurant | Disponible dans **Statistiques** |
| Statistiques hebdomadaires de l’employé | Employé | Calcul disponible côté serveur ; écran non encore accessible |
| Consultation et avancement des commandes | Employé, gérant, administrateur du restaurant | Traitement disponible côté serveur ; écran du personnel absent |
| Marquer un plat épuisé ou comme plat du jour | Employé, gérant, administrateur du restaurant | Traitement et écran préparés ; écran non encore accessible depuis l’application |
| Ajouter, modifier ou retirer un plat | Administrateur du restaurant | Traitement disponible côté serveur ; écran d’administration non encore accessible |
| Créer des comptes employés | Gérant et administrateur selon les droits prévus | Fonction non encore disponible |
| Créer ou modifier des promotions | Administrateur du restaurant selon les droits prévus | Fonction non encore disponible ; les promotions existantes peuvent être consultées publiquement |

Les droits prévus sont détaillés dans [Rôles et permissions](roles-permissions.md). Le présent guide distingue ces droits des fonctions effectivement accessibles.

## 2. Se connecter et se déconnecter

1. Ouvrez l’application et choisissez **Connexion**. Si nécessaire, ouvrez `/login` sur le même site.
2. Saisissez votre adresse e-mail ou votre numéro de téléphone, puis votre mot de passe.
3. Cliquez sur **Se connecter**.
4. Après une connexion réussie, vous revenez à la page demandée auparavant, ou à l’accueil si aucune page n’avait été demandée.

Demandez votre compte à l’équipe responsable de la démonstration. **Créer un compte** ouvre l’inscription des étudiants : ce formulaire ne crée pas un compte employé, gérant ou administrateur.

Si un message signale des identifiants incorrects, vérifiez les informations saisies. Si le compte est désactivé ou si l’erreur persiste, contactez le responsable du projet. Les données de connexion d’un autre restaurant ne permettent pas d’en gérer les commandes ou les statistiques avec votre compte.

Pour quitter votre session, cliquez sur **Déconnexion**. Sur téléphone, ouvrez d’abord le menu avec le bouton **☰** si les liens sont repliés.

### Capture 1 — Connexion

> **À ajouter :** capture de la page de connexion avec un compte de démonstration. Ne montrez pas de mot de passe, de jeton ni de données personnelles réelles. Le résultat attendu est le formulaire avec **Adresse e-mail ou téléphone**, **Mot de passe** et **Se connecter**.

## 3. Employé : commandes et disponibilité des plats

### Commandes

Votre rôle autorise la consultation et l’avancement des commandes de votre restaurant. Toutefois, le lien **Commandes** n’ouvre pas encore un écran de traitement dans cette version : il aboutit à **Page indisponible**.

Il n’existe donc pas encore de procédure utilisable dans l’application pour confirmer une commande, la passer en préparation ou la terminer. Ne considérez pas une commande comme modifiée tant qu’une action n’a pas été enregistrée par une fonction disponible.

### Plat épuisé et plat du jour

Votre rôle autorise le changement de disponibilité et le choix des plats du jour. L’écran préparé contient les colonnes **Disponible** et **Plat du jour**, mais le lien **Menu** du personnel n’ouvre pas encore cet écran.

La procédure de modification et sa capture seront ajoutées après son raccordement. L’employé n’a pas le droit de créer, modifier le prix ou supprimer un plat.

### Statistiques de l’employé

Votre rôle est limité aux statistiques hebdomadaires de votre restaurant. L’écran correspondant n’est pas encore accessible. Le bilan global décrit dans la section suivante est réservé au gérant et à l’administrateur du restaurant.

### Capture 2 — Menu rapide du personnel

> **Emplacement en attente du raccordement de l’écran.** Avec le compte employé de démonstration, montrer un plat et ses colonnes **Disponible** et **Plat du jour**. Ne pas remplacer cette capture par une maquette ou présenter une page indisponible comme une fonction utilisable.

## 4. Gérant : consulter les statistiques

1. Connectez-vous avec votre compte gérant.
2. Cliquez sur **Statistiques**. L’adresse de cet écran est `/staff/overview`.
3. Choisissez **Aujourd’hui**, **Semaine** ou **Mois**.
4. Consultez les tuiles **Ventes**, **Commandes** et **Panier moyen**, puis la liste **Plats les plus vendus**.
5. Pour demander immédiatement une nouvelle lecture, cliquez sur **Actualiser**.

Les chiffres sont actualisés automatiquement toutes les **30 secondes**. L’heure de la dernière mise à jour est affichée en heure de **Kinshasa**. La semaine commence le lundi.

Les ventes concernent les commandes terminées pendant la période. Le compteur **Commandes** concerne les commandes créées pendant cette période : les deux chiffres peuvent donc différer. Le panier moyen est calculé sur les commandes terminées. Les montants sont affichés en FC.

La longueur des barres du classement représente les quantités vendues. Si aucun plat n’a été vendu, la page affiche **Aucune vente sur cette période.**

Lors d’une panne d’actualisation, les anciens chiffres peuvent rester visibles avec un avertissement et leur date. Cliquez sur **Actualiser** pour réessayer. Si l’accès est refusé, les chiffres sont retirés : vérifiez votre connexion et votre rôle.

### Création d’employés

La création et la gestion des employés sont prévues dans les permissions du gérant, mais ne sont pas encore disponibles dans l’application. Aucun bouton **Créer un employé** ni formulaire correspondant ne doit être supposé présent. Pour la démonstration, utilisez les comptes préparés par l’équipe.

## 5. Administrateur du restaurant : carte, promotions et statistiques

### Carte du restaurant

L’administrateur possède le droit d’ajouter, de modifier et de retirer les plats de son restaurant. Un écran avec **+ Ajouter un plat**, **Enregistrer** et **Supprimer** est préparé dans le projet, mais le lien **Menu** de l’administrateur ne l’ouvre pas encore.

Ces opérations ne sont donc pas présentées ici comme une procédure déjà utilisable. Le formulaire de création et la liste des plats devront être vérifiés après ouverture effective de cet écran. La présence d’un traitement côté serveur ne suffit pas à rendre le bouton disponible dans l’application.

### Promotions

La création et la modification des promotions ne sont pas encore disponibles. La consultation publique des promotions existantes ne permet pas de les administrer. Le guide sera complété lorsque les actions correspondantes seront accessibles.

### Statistiques et employés

L’administrateur du restaurant peut utiliser le bilan décrit dans la section **Gérant : consulter les statistiques**. Il voit uniquement les données de son restaurant. La création de comptes employés reste indisponible, comme pour le gérant.

L’administrateur d’un restaurant ne crée pas les autres restaurants et ne change pas leur statut : ces opérations appartiennent à l’administration de la plateforme.

### Capture 3 — Carte de l’administrateur

> **Emplacement en attente du raccordement de l’écran.** Avec l’administrateur de démonstration du restaurant concerné, montrer la liste des plats et le formulaire **Ajouter un plat**. Ne montrez pas un écran de gestion des promotions tant qu’il n’existe pas.

### Capture 4 — Statistiques, avec données de démonstration

La capture ci-dessous provient du contrôle local du 3 novembre 2026 avec l’API et une base temporaire : **2 500 FC**, **2 commandes**, un panier moyen de **1 250 FC** et **5 portions**. Ces nombres ne représentent pas l’activité réelle d’un restaurant. Le compte utilisé est un administrateur de restaurant de démonstration ; le gérant est autorisé au même écran.

![Statistiques du restaurant avec données de démonstration](statistiques/integration-locale.png)

## 6. Si une page ne fonctionne pas

| Ce que vous voyez | Que faire |
| --- | --- |
| **Page indisponible** après un clic sur Commandes ou Menu du personnel | Consultez le tableau des fonctions disponibles. Ce n’est pas une confirmation d’action. |
| **Impossible de charger les statistiques** | Réessayez avec **Actualiser**. Si le problème continue, signalez-le à l’équipe. |
| Message d’accès refusé | Vérifiez le compte utilisé. Un employé ne peut pas ouvrir le bilan global. |
| Anciennes valeurs avec avertissement | Vérifiez la date affichée ; attendez une actualisation réussie avant d’utiliser ces chiffres. |

## 7. Compléter les captures et tenir le guide à jour

Quatre emplacements sont identifiés : **connexion**, **menu du personnel**, **carte administrateur**, **statistiques**. Seul le quatrième est illustré ici. Les trois autres restent à compléter, et les captures 2 et 3 exigent d’abord l’ouverture des écrans correspondants.

Utilisez uniquement les comptes de démonstration préparés par l’équipe. Le jeu de démonstration fournit notamment `employe@monmiam.test` et `admin@zeduc-space.test` ; leurs mots de passe sont définis lors de sa préparation et ne sont pas publiés dans ce guide. Un compte gérant doit être fourni séparément : le jeu initial n’en crée pas.

Après chaque évolution, vérifiez les liens, les intitulés des boutons et les droits de chaque rôle avant de modifier les procédures. Faites relire le guide par un membre du personnel qui n’a pas développé l’écran. Cette validation utilisateur et les captures manquantes ne sont pas annoncées comme terminées.

### Références pour la relecture du guide

- Pages accessibles : [routeur](../frontend/src/App.tsx) et [navigation par rôle](../frontend/src/views/components/Layout.tsx).
- Connexion et retour à la page demandée : [connexion](../frontend/src/views/pages/LoginPage.tsx), [protection des pages](../frontend/src/views/components/RequireRole.tsx).
- Écrans de menu préparés : [personnel](../frontend/src/views/pages/StaffMenuPage.tsx), [administrateur](../frontend/src/views/pages/AdminMenuPage.tsx).
- Statistiques : [écran](../frontend/src/views/pages/StatsPage.tsx), [actualisation et erreurs](../frontend/src/controllers/stats.ts), [contrat API](api/statistiques.md).
- Droits prévus : [rôles et permissions](roles-permissions.md). Comptes de démonstration : [préparation des données](../backend/src/seed.ts).
