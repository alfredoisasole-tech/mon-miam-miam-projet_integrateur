# Plan de gestion des risques

Échelle : **probabilité** et **gravité** de 1 (faible) à 3 (forte). La **criticité** est leur produit ; au-dessus de 6, le risque est suivi à chaque point d'avancement.

| N° | Risque | Prob. | Grav. | Crit. | Mesure pour l'éviter ou l'atténuer | Responsable |
|---|---|---|---|---|---|---|
| R1 | **Retard de livraison** : certaines fonctions du cahier des charges ne sont pas prêtes à la date prévue | 3 | 3 | 9 | Suivi du périmètre dans Jira, priorité aux fonctions obligatoires, paiement réel traité comme bonus, reprise des tâches en retard par le responsable technique | Responsable technique |
| R2 | **Code qui ne correspond pas au contrat** : le site appelle une route ou un format qui n'existe pas | 2 | 3 | 6 | Contrats d'API écrits dans `docs/api/`, test de parcours complet, relecture de chaque pull request | Responsable technique |
| R3 | **Bug critique sur la commande ou les points** (montant faux, double crédit) | 2 | 3 | 6 | Montants toujours recalculés par le serveur, clé d'idempotence, crédit des points en transaction, tests automatiques sur tous ces cas | Binôme serveur |
| R4 | **Mauvaise fusion** : conflits entre branches, travail perdu | 3 | 2 | 6 | Branches courtes par fonction, pull requests vers `dev`, CI obligatoire, fusion avec commit de fusion, aucune réécriture de `dev` ou `main` | Tous |
| R5 | **Perte des données** : base SQLite recréée à chaque redémarrage (offre gratuite) | 3 | 2 | 6 | Utiliser l'hébergement gratuit uniquement pour la démonstration ; prévoir un disque persistant ou une base externe avant tout usage réel | Responsable technique |
| R6 | **Panne ou mise en veille du serveur** pendant une démonstration | 3 | 2 | 6 | Réveiller l'API quelques minutes avant, vérifier `GET /api/health`, prévoir une capture ou une vidéo de secours | Chef de projet |
| R7 | **Faille de sécurité** (accès à un autre restaurant, mot de passe exposé, injection) | 1 | 3 | 3 | Restaurant toujours déduit du jeton, mots de passe hachés, images PNG, JPEG, WebP vérifiées par signature (pas de SVG), en-têtes de sécurité, tests d'isolation | Binôme serveur |
| R8 | **Fournisseur de paiement indisponible ou non validé** | 2 | 2 | 4 | Paiement en espèces toujours possible, mode simulé pour les démonstrations, intégration réelle seulement après essai avec les clés de test | Binôme paiement |
| R9 | **Envoi du code de mot de passe oublié impossible** (pas de fournisseur SMS ou e-mail) | 3 | 1 | 3 | Code visible dans les journaux hors production, réponse 503 explicite en production, choix du fournisseur à faire avant l'ouverture au public | Responsable technique |
| R10 | **Données personnelles mal protégées** (RGPD) | 1 | 3 | 3 | Export et suppression anonymisante disponibles, noms masqués dans les classements, aucune donnée inutile collectée, page de confidentialité | Responsable technique |
| R11 | **Désaccord sur une règle métier** (validité des points, montant du parrainage, commandes en cours lors d'une désactivation) | 2 | 2 | 4 | Règles écrites dans les contrats, décision tracée dans Jira, taux modifiables par restaurant sans nouveau déploiement | Chef de projet |
| R12 | **Indisponibilité d'un membre** (maladie, examens) | 2 | 2 | 4 | Travail en binômes, documentation à jour, tâches réattribuables dans Jira | Chef de projet |
| R13 | **Mise en page inutilisable sur téléphone** | 2 | 2 | 4 | Maquette adaptable, menu replié sur petit écran, essai sur de vrais téléphones pendant la bêta | Binôme site |

## Suivi

- Le tableau est relu à chaque point d'avancement ; on ajoute les risques nouveaux et on baisse ceux qui disparaissent.
- Un risque qui se réalise est noté dans le compte rendu de réunion avec la décision prise.
