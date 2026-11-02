# Règles multi-restaurants

Mon Miam Miam permet à un étudiant d'utiliser un seul compte dans plusieurs restaurants. Chaque restaurant conserve ses menus, ses promotions, son personnel, ses commandes, ses paiements et ses points de fidélité. Ces règles servent de référence commune aux quatre binômes pour concevoir la base de données, les API et les interfaces.

- **Tâche :** [APP-36 - Définir les règles multi-restaurants](https://judbie2030-45660043.atlassian.net/browse/APP-36), sous-tâche 1.3 de [US1 - APP-9](https://judbie2030-45660043.atlassian.net/browse/APP-9).
- **Rédacteur :** Emmanuel Mboyo (`emmanuelmboyo-dotcom`).
- **Date de rédaction :** 28 octobre 2026.
- **Validation :** à obtenir auprès des quatre binômes dans la pull request.

Les restaurants A et B utilisés dans les exemples sont fictifs.

## 1. Création et gestion des restaurants

L'administrateur de la plateforme crée et désactive les restaurants. Ce rôle est distinct de celui d'administrateur d'un restaurant. Un employé, un gérant ou un administrateur de restaurant ne peut pas créer un autre restaurant au titre de son rôle local.

La sélection destinée aux nouvelles commandes présente les restaurants actifs. La désactivation d'un restaurant doit empêcher de nouvelles commandes chez lui sans effacer l'historique de ses commandes et paiements.

**Exemple :** l'administrateur de la plateforme crée le restaurant B ; le gérant du restaurant A ne peut pas effectuer cette création avec ses droits de gérant.

## 2. Un seul compte, une adhésion par restaurant

Une adresse e-mail correspond à un seul compte utilisateur pour toute la plateforme. L'étudiant conserve les mêmes identifiants lorsqu'il utilise un autre restaurant. Son adhésion à chaque restaurant est distincte : elle relie son compte à ce restaurant et porte les informations propres à cette relation, notamment son solde de points.

L'utilisateur choisit un restaurant dans la liste, puis consulte le menu et les promotions de celui-ci. L'interface indique le restaurant sélectionné pour que l'étudiant sache où il commande. Changer de restaurant ne crée pas un nouveau compte et ne transfère ni commandes ni points. L'étudiant ne consulte que ses propres commandes.

**Exemple :** un étudiant déjà inscrit commande chez A puis chez B avec le même e-mail et le même mot de passe, tout en conservant deux adhésions et deux soldes de points distincts.

## 3. Un panier et une commande appartiennent à un seul restaurant

Tous les articles d'un panier doivent appartenir au même restaurant. La commande créée à partir de ce panier reste rattachée à ce restaurant. Un panier contenant un plat de A ne peut pas recevoir un plat de B ; l'interface explique cette restriction et le serveur refuse également le mélange.

Les plats, catégories et promotions sont rattachés à leur restaurant. Une promotion de A ne s'applique pas aux articles de B. Si l'étudiant change de restaurant alors que son panier contient des articles, l'interface demande confirmation : accepter le changement vide le panier ; annuler conserve le restaurant et le panier actuels. Aucun article n'est transféré au nouveau restaurant.

**Exemple :** si le panier contient un plat du restaurant A, l'étudiant confirme son passage au restaurant B, le panier est vidé et il peut alors y ajouter une boisson de B.

## 4. Le personnel accède seulement à son restaurant

Chaque membre du personnel est rattaché à un restaurant. Ses droits d'employé, de gérant ou d'administrateur s'exercent dans ce restaurant, selon les permissions de son rôle. Il consulte et modifie uniquement les commandes, le menu et les autres données auxquelles son rôle lui donne accès dans ce périmètre. Les statistiques portent uniquement sur les données de ce restaurant.

Le serveur vérifie le rattachement et les permissions à chaque opération. Modifier un identifiant dans une adresse ou dans une requête ne donne aucun accès aux commandes, aux menus, au personnel ou aux statistiques d'un autre restaurant. Le détail des permissions relève de [APP-34 - Définir les rôles des utilisateurs](https://judbie2030-45660043.atlassian.net/browse/APP-34).

**Exemple :** un employé du restaurant A peut traiter les commandes de A autorisées par son rôle, mais ne peut ni consulter ni modifier une commande de B, même s'il connaît son identifiant.

## 5. Les points de fidélité restent propres à chaque restaurant

Les points sont gagnés, consultés et utilisés dans le restaurant concerné. Le solde est associé au couple étudiant-restaurant ; il n'existe pas de solde commun utilisable dans tous les restaurants. Les points de A ne peuvent être ni transférés ni additionnés à ceux de B pour obtenir une remise.

Le barème retenu est de **3 000 FC dépensés pour 1 point** et de **15 points pour une réduction fixe de 3 000 FC**, appliquée dans le restaurant où les points ont été gagnés. Toute attribution ou utilisation de points doit concerner le même restaurant que la commande associée.

**Exemple :** un étudiant ayant 15 points chez A et 5 points chez B peut utiliser la remise de 3 000 FC chez A, mais ne peut pas utiliser ses points de A pour une commande chez B.

## 6. Chaque paiement est lié à sa commande et à son restaurant

Un paiement concerne une commande identifiée et le restaurant de cette commande. Le restaurant du paiement découle de celui de la commande ; il ne peut pas être choisi séparément par le client. Le serveur vérifie également que l'étudiant qui lance le paiement est autorisé à payer cette commande.

Dans le périmètre actuel, le paiement en ligne passe par une redirection vers une page de paiement simulée. Le résultat met à jour uniquement la commande concernée. Une référence ou un résultat de paiement lié à A ne peut pas régler une commande de B. Le détail du parcours relève de [APP-35 - Définir les règles de commande et de paiement](https://judbie2030-45660043.atlassian.net/browse/APP-35).

**Exemple :** le paiement de la commande A-001 est enregistré pour le restaurant A et ne peut pas être utilisé pour marquer la commande B-001 comme payée.

## Conséquences pour les données et les API

Les règles ci-dessus imposent les contraintes suivantes, quelle que soit leur traduction technique dans le schéma de données.

| Élément | Contrainte à respecter |
| --- | --- |
| Compte utilisateur | L'e-mail est unique à l'échelle de la plateforme. |
| Adhésion étudiante | Un seul rattachement par couple compte-restaurant ; le solde de fidélité appartient à ce couple. |
| Personnel | Le rattachement au restaurant et le rôle sont vérifiés côté serveur. |
| Menu et promotions | Chaque plat, catégorie et promotion appartient à un restaurant ; les relations restent dans ce restaurant. |
| Panier et commande | Tous les articles viennent du restaurant de la commande ; celle-ci reste liée à son étudiant. |
| Paiement et points d'une commande | Ils se rapportent à la bonne commande et au même restaurant que celle-ci. |
| Statistiques | Les calculs et résultats sont limités au restaurant autorisé. |

Le filtrage dans l'interface facilite la navigation ; les contrôles du serveur garantissent l'isolation des données.

## Vérification et validation par l'équipe

Les scénarios ci-dessous servent à relire les règles et à préparer les futurs tests applicatifs. Ils ne constituent pas un compte rendu de tests exécutés.

| Scénario | Résultat attendu |
| --- | --- |
| Un administrateur de plateforme crée B ; un gérant de A tente la même action. | La création est autorisée pour le premier et refusée pour le second. |
| Un étudiant utilise le même compte chez A et chez B. | Le compte reste unique et les adhésions restent distinctes. |
| L'étudiant sélectionne B. | Le menu et les promotions affichés appartiennent à B. |
| Un panier de A reçoit un article ou une promotion de B. | Le mélange est refusé dans l'interface et par le serveur. |
| L'étudiant change de restaurant avec un panier rempli. | Une confirmation est demandée : accepter vide le panier ; annuler conserve le panier et le restaurant actuels. |
| Le personnel de A demande une commande ou des statistiques de B. | L'accès est refusé et aucune donnée de B n'est exposée. |
| Un étudiant possédant 15 points chez A veut les utiliser chez B. | La remise est refusée ; les soldes restent séparés. |
| Un résultat de paiement de A est présenté pour une commande de B. | La commande de B n'est pas marquée payée. |
| Un restaurant est désactivé. | Les nouvelles commandes sont bloquées et l'historique est conservé. |

Avant fusion vers `dev`, chaque binôme confirme explicitement « OK » dans la pull request de la branche `docs/regles-multi-restaurants`. Les validations portent sur cette version du document et sur ses conséquences pour les données, les API et les interfaces.

| Binôme | Point de relecture | Validation |
| --- | --- | --- |
| A - Emmanuel et Judy | Cohérence des règles et distinction des rôles. | À obtenir dans la PR. |
| B - Gloire et Brayan | Choix du restaurant, panier, promotions et affichage des points. | À obtenir dans la PR. |
| C - Don et Lusimafu | Rattachements des données, permissions et statistiques. | À obtenir dans la PR. |
| D - Alfredo et Gabriel | Cohérence commande-paiement et isolation de la fidélité. | À obtenir dans la PR. |

Toute modification d'une règle est discutée dans la pull request avant validation. Le statut d'une tâche Jira ne remplace pas l'accord des quatre binômes sur ce document.
