# Guide du personnel — Mon Miam Miam

Version du **3 novembre 2026**. Responsable : Emmanuel Mboyo. Travail E-9, rattaché à [APP-96 — Finaliser le bilan et la documentation](https://judbie2030-45660043.atlassian.net/browse/APP-96).

Ce guide concerne l’employé, le gérant et l’administrateur d’un restaurant. L’administrateur de la plateforme possède un rôle distinct. Chaque compte du personnel intervient uniquement dans le restaurant auquel il est rattaché.

## 1. Ce qui est disponible aujourd’hui

Ce guide décrit `dev` au commit `15e2918`, complété par le [correctif de raccordement des menus, PR #62](https://github.com/alfredoisasole-tech/mon-miam-miam-projet_integrateur/pull/62). Les procédures et captures des menus ci-dessous nécessitent ce correctif : **fusionner #62 avant de présenter ces écrans depuis `dev`**. Les fonctions encore absentes sont indiquées explicitement.

| Fonction | Personnes concernées | État dans l’application |
| --- | --- | --- |
| Connexion et déconnexion | Tout le personnel | Disponibles |
| Bilan du restaurant : jour, semaine, mois | Gérant et administrateur du restaurant | Disponible dans **Statistiques** |
| Statistiques hebdomadaires de l’employé | Employé | Disponibles dans **Statistiques** (`/staff/weekly`) |
| Consultation et avancement des commandes | Employé, gérant, administrateur du restaurant | Disponibles dans **Commandes** |
| Marquer un plat épuisé ou comme plat du jour | Employé, gérant, administrateur du restaurant | Disponible dans **Menu** après intégration de #62 |
| Ajouter ou retirer un plat | Administrateur du restaurant | Disponible dans **Menu** après intégration de #62 |
| Modifier le nom, le prix ou la catégorie d’un plat existant | Administrateur du restaurant | Traitement disponible côté serveur ; formulaire de modification absent |
| Créer des comptes employés | Gérant et administrateur | Disponible dans **Équipe** |
| Créer ou modifier des promotions | Administrateur du restaurant | Disponible dans **Promotions** |

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

Formulaire avec l’adresse du compte employé de démonstration, sans mot de passe affiché.

![Connexion avec le compte employé de démonstration](manuel-personnel/connexion.jpg)

## 3. Employé : commandes et disponibilité des plats

### Commandes

Cliquez sur **Commandes** pour ouvrir `/staff/orders`, **Les commandes du service**. Le tableau liste les commandes de votre restaurant avec leur numéro, leur service (sur place ou livraison), les articles, le total, le paiement et le statut.

1. Utilisez le filtre pour n’afficher que les commandes à traiter.
2. Dans la colonne **Actions**, faites avancer la commande : confirmée, en préparation, prête, puis terminée (et « en livraison » avant « terminée » pour une livraison).
3. Le tableau se met à jour automatiquement ; l’état affiché est toujours celui enregistré par le serveur.

### Plat épuisé et plat du jour

1. Cliquez sur **Menu** pour ouvrir `/staff/menu` et l’écran **Gestion rapide du menu (Staff)**.
2. Repérez le plat dans le tableau.
3. Décochez **Disponible** pour signaler un plat épuisé ; cochez la case pour le rendre disponible.
4. Cochez ou décochez **Plat du jour** selon le service prévu.
5. Chaque changement est enregistré immédiatement. Vérifiez l’absence de message d’erreur ; en cas de doute, rechargez la page pour relire l’état enregistré.

L’employé n’a pas le droit de créer, modifier le prix ou supprimer un plat. Le gérant et l’administrateur peuvent également ouvrir `/staff/menu`. Le lien **Menu** de l’administrateur conduit toutefois directement à sa carte, décrite plus bas. La colonne **Catégorie** du menu rapide affiche actuellement un tiret.

### Statistiques de l’employé

Cliquez sur **Statistiques** pour ouvrir `/staff/weekly`, **Ventes de la semaine** : total encaissé, nombre de commandes terminées et détail par jour, du lundi au dimanche. Le bilan global (jour, semaine, mois) est réservé au gérant et à l’administrateur.

### Capture 2 — Menu rapide du personnel

Après modification et rechargement avec le compte employé de démonstration, **Pondu** est indisponible et marqué comme plat du jour. Les autres plats restent disponibles.

![Menu rapide du personnel après enregistrement et rechargement](manuel-personnel/menu-personnel.jpg)

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

Cliquez sur **Équipe** (`/staff/accounts`) puis remplissez **Nom**, **E-mail**, **Téléphone** (`+243XXXXXXXXX`) et **Rôle**. Le gérant crée des employés ; seul l’administrateur peut aussi créer un gérant.

Le compte reçoit un **mot de passe temporaire** affiché **une seule fois** : transmettez-le à la personne. À sa première connexion, elle est dirigée vers **Mon profil** et doit choisir un nouveau mot de passe avant d’utiliser le reste du site. Seul l’administrateur peut **modifier** un compte (nom, téléphone, rôle employé ou gérant ; l’e-mail ne change pas), le **désactiver** (confirmation demandée) ou le **réactiver**. Changer le rôle ou le téléphone oblige la personne à se reconnecter ; un administrateur ne peut modifier ni son propre rôle ni son propre état.

**Mot de passe oublié.** Quand une personne a tout oublié (aucun SMS ni e-mail n'est envoyé), cliquez sur **Mot de passe oublié** à côté de son nom, puis **Oui, générer** : un nouveau mot de passe temporaire s'affiche **une seule fois**, à lui transmettre. Elle devra le changer dès sa connexion et ses anciennes sessions sont fermées. Le gérant réinitialise les employés ; l'administrateur, les employés et les gérants (jamais un administrateur, ni son propre compte : utilisez **Mon profil**). Chacun peut aussi modifier son nom et son numéro depuis **Mon profil**.

## 5. Administrateur du restaurant : carte, promotions et statistiques

### Carte du restaurant

1. Avec un compte administrateur du restaurant, cliquez sur **Menu** pour ouvrir `/admin/menu` et **Administration du Menu**.
2. Cliquez sur **+ Ajouter un plat**.
3. Renseignez **Nom**, **Description**, **Prix (FC)** et **Catégorie** (`plat`, `boisson`, `dessert` ou `snack`). Le nom doit contenir entre 2 et 80 caractères et le prix doit être un entier supérieur ou égal à zéro.
4. Choisissez les états **Plat du jour** et **Disponible**, puis cliquez sur **Enregistrer**. Le formulaire se ferme et le nouveau plat apparaît dans la liste après une création réussie.
5. Pour abandonner la saisie, cliquez sur **Annuler**.
6. Pour retirer un plat, cliquez sur son bouton **Supprimer**, puis confirmez la demande. Vérifiez qu’il a disparu de la liste et qu’aucune erreur n’est affichée.

Le formulaire de modification du nom, du prix ou de la catégorie d’un plat existant n’est pas encore disponible. Pour sa disponibilité et son statut de plat du jour, utilisez `/staff/menu`. Un employé ou un gérant ne peut pas ouvrir la carte d’administration.

### Promotions

Cliquez sur **Promotions** (`/admin/promotions`). Choisissez le **Type** (promotion, événement ou jeu), saisissez le **Titre**, une description facultative, les dates de **Début** et de **Fin**, puis cliquez sur **Créer**. Chaque publication peut être désactivée, réactivée ou supprimée (confirmation demandée). Les clients ne voient que les publications actives et dans leur période.

### Statistiques et employés

L’administrateur du restaurant peut utiliser le bilan décrit dans la section **Gérant : consulter les statistiques**. Il voit uniquement les données de son restaurant. Il crée, modifie, désactive et réactive aussi les comptes du personnel depuis **Équipe**, et redonne un mot de passe temporaire à qui l'a oublié.

L’administrateur d’un restaurant ne crée pas les autres restaurants et ne change pas leur statut : ces opérations appartiennent à l’administration de la plateforme.

### Capture 3 — Carte de l’administrateur

Le formulaire de création et la liste existante sont affichés avec le compte administrateur de démonstration. **Riz et haricots** est ici un exemple en cours de saisie ; sa création a ensuite été vérifiée avec l’API locale.

![Carte administrateur et formulaire de création d’un plat](manuel-personnel/menu-administrateur.jpg)

### Capture 4 — Statistiques, avec données de démonstration

La capture ci-dessous provient du contrôle local du 3 novembre 2026 avec l’API et une base temporaire : **2 500 FC**, **2 commandes**, un panier moyen de **1 250 FC** et **5 portions**. Ces nombres ne représentent pas l’activité réelle d’un restaurant. Le compte utilisé est un administrateur de restaurant de démonstration ; le gérant est autorisé au même écran.

![Statistiques du restaurant avec données de démonstration](manuel-personnel/statistiques.jpg)

## 6. Réclamations, paramètres et plateforme

### Réclamations (employé, gérant, administrateur)

Cliquez sur **Réclamations** (`/staff/claims`). Filtrez par état : **À traiter**, **À valider**, **Traitées**. La liste se met à jour toute seule toutes les 30 secondes.

1. **Employé** : ouvrez une réclamation à traiter, choisissez **Accepter** ou **Refuser**, écrivez une réponse de 5 à 500 caractères et cliquez sur **Proposer**. La réclamation passe à valider.
2. **Gérant** : relisez la proposition, puis cliquez sur **Valider** (la réponse part à l’étudiant) ou écrivez une note et cliquez sur **Renvoyer** pour demander une nouvelle proposition.
3. **Réclamation de points** : seul l’**administrateur** la valide. Il indique les **points accordés** (au plus le nombre demandé) ; ils sont crédités une seule fois à l’étudiant.

### Paramètres du restaurant (administrateur)

Cliquez sur **Paramètres** (`/admin/settings`). Chaque restaurant choisit lui-même son identité visuelle, sans nouveau déploiement :

- **Nom** et **slogan** ;
- **Couleur principale** et **couleur secondaire** au format `#rrggbb` (par défaut doré `#cfbd97` et noir `#000000`) ;
- **Police** parmi Poppins, Arial, Verdana, Trebuchet MS, Georgia, Tahoma, Times New Roman ;
- **Mode par défaut** : clair, sombre ou selon l’appareil ;
- **Logo** : PNG, JPEG ou WebP de 512 Ko au plus ;
- **Horaires d’ouverture** de chaque jour (laissez vide un jour fermé) ;
- **Livraison** : activée ou non, frais en FC, communes desservies ;
- **Fidélité** : dépense pour 1 point (3 000 FC par défaut), points pour une récompense (15), valeur de la récompense (3 000 FC), validité en mois (12).

**Où s'applique cette identité.** La charte du restaurant (logo, couleurs, police, mode) habille les écrans propres au restaurant : menu, panier, commandes, points, réclamations, communauté et tous les écrans du personnel. Elle s'applique aussitôt après l'enregistrement, sans recharger la page. La plateforme garde sa propre charte, **fixe** (noir et doré, avec son logo) : accueil, connexion, inscription, profil, pages légales et espace de la plateforme ne changent jamais d'aspect d'un restaurant à l'autre. Sur l'accueil, chaque restaurant apparaît avec son logo et ses couleurs.

Cliquez sur **Enregistrer** : seuls les blocs modifiés sont envoyés. Les nouvelles règles de fidélité s’appliquent aux prochaines commandes ; les points déjà gagnés gardent leur date d’expiration. Les autres restaurants ne sont jamais affectés.

### Administrateur de la plateforme

Cliquez sur **Restaurants** (`/plateforme`). La liste montre tous les restaurants, y compris désactivés, avec leurs administrateurs. Vous pouvez **désactiver** ou **réactiver** un restaurant (il disparaît alors des pages publiques) et **créer un restaurant** avec son premier administrateur (nom, identifiant, e-mail, téléphone, mot de passe initial).

### Mon profil

Le lien **Mon profil**, en bas de page, permet à chaque membre du personnel de changer son mot de passe.

## 7. Si une page ne fonctionne pas

| Ce que vous voyez | Que faire |
| --- | --- |
| Une commande ne change pas d’état | Rechargez la page, vérifiez le message d’erreur et votre rôle ; l’état affiché est celui enregistré. |
| **Page indisponible** après un clic sur **Menu** | Vérifiez que le correctif #62 est intégré dans la version utilisée. |
| **Impossible de charger le menu** ou erreur après une modification | Vérifiez la connexion et votre rôle ; rechargez pour relire les valeurs enregistrées avant de réessayer. |
| **Impossible de charger les statistiques** | Réessayez avec **Actualiser**. Si le problème continue, signalez-le à l’équipe. |
| Message d’accès refusé | Vérifiez le compte utilisé. Un employé ne peut pas ouvrir le bilan global. |
| Anciennes valeurs avec avertissement | Vérifiez la date affichée ; attendez une actualisation réussie avant d’utiliser ces chiffres. |

## 8. Compléter les captures et tenir le guide à jour

Les quatre captures sont présentes : **connexion**, **menu du personnel**, **carte administrateur**, **statistiques**. Elles ont été prises le **3 novembre 2026**, sur une version locale avec le correctif #62, une API réelle et une base de démonstration temporaire. Aucune donnée d’activité réelle n’y figure.

Utilisez uniquement les comptes de démonstration préparés par l’équipe. Le jeu de démonstration fournit notamment `employe@monmiam.test` et `admin@zeduc-space.test` ; leurs mots de passe sont définis lors de sa préparation et ne sont pas publiés dans ce guide. Un compte gérant doit être fourni séparément : le jeu initial n’en crée pas.

Après chaque évolution, vérifiez les liens, les intitulés des boutons et les droits de chaque rôle avant de modifier les procédures. Faites relire le guide par un membre du personnel qui n’a pas développé l’écran. Cette validation utilisateur reste à obtenir ; les captures ne la remplacent pas.

### Références pour la relecture du guide

- Pages accessibles : [routeur](../frontend/src/App.tsx) et [navigation par rôle](../frontend/src/views/components/Layout.tsx).
- Connexion et retour à la page demandée : [connexion](../frontend/src/views/pages/LoginPage.tsx), [protection des pages](../frontend/src/views/components/RequireRole.tsx).
- Écrans de menu préparés : [personnel](../frontend/src/views/pages/StaffMenuPage.tsx), [administrateur](../frontend/src/views/pages/AdminMenuPage.tsx).
- Statistiques : [écran](../frontend/src/views/pages/StatsPage.tsx), [actualisation et erreurs](../frontend/src/controllers/stats.ts), [contrat API](api/statistiques.md).
- Droits prévus : [rôles et permissions](roles-permissions.md). Comptes de démonstration : [préparation des données](../backend/src/seed.ts).
