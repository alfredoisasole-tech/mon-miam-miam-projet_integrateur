# Contrôles et validation - E-4

Préparation : 30 octobre 2026 ; suivi actualisé le 31 octobre 2026. Responsable : Emmanuel Mboyo. Branche : `docs/maquettes-validees`.

## Copie de travail actuelle

Suivi : [APP-99 — E-4 : Maquettes et liens Figma](https://judbie2030-45660043.atlassian.net/browse/APP-99). Le ticket reste ouvert tant que les critères ci-dessous ne sont pas tous vérifiés.

La [copie E-4 d’Emmanuel](https://www.figma.com/design/mnn8o6VMsuz24FWleKDdlm/Mon-Miam-Miam) est modifiable dans son compte. Le tableau historique ci-dessous porte sur le fichier source de Judbie ; son refus d’édition ne concerne pas la copie.

- Les quatre noms de plats et leurs descriptions ont été adaptés ; Coca-Cola remplace le bissap dans les exemples. Fanta et Vital’O figurent dans la présentation promotionnelle.
- La copie a été ouverte sans compte dans le navigateur intégré le 31 octobre ; un test Chrome Incognito propre à cette copie reste à consigner.
- Les 1 504 textes sélectionnés avec la même police Inter ont été passés en Poppins : le panneau de famille de polices affiche désormais Poppins. Figma signale toutefois que certaines modifications ne seront pas synchronisées avant sa reconnexion. La synchronisation, les autres styles et les débordements doivent être contrôlés avant export.
- Les photos, les cartes de boissons et les exports de la version modifiée restent à terminer. Les PNG actuels correspondent toujours au PDF source.
- Validateur : Judbie. Emmanuel rapporte un accord donné le 26 octobre 2026. Cet accord précède les adaptations du 31 octobre ; leur relecture par Judbie reste à obtenir. Aucune trace externe datée de l’accord n’a été fournie.

## Historique du contrôle de la source

## Résultat des contrôles

| Contrôle | Résultat au 30 octobre 2026 | Preuve ou action restante |
| --- | --- | --- |
| Lien du bon fichier | Confirmé par Emmanuel | [Mon Miam Miam dans Figma](https://www.figma.com/design/nq0KxUaeuNisAe4a6yPvBs/Mon-Miam-Miam?node-id=4-111966) |
| Connexion et accès en modification | Compte Emmanuel confirmé ; siège Figma « View » ; modification refusée | Le connecteur identifie Emmanuel MBOYO et son siège « View ». La création d’une session pour ce fichier est refusée faute d’accès en modification. Demander au propriétaire du fichier l’accès « Editor » avant toute adaptation. Aucun changement de maquette n’a été appliqué. |
| Lecture sans compte | Réussi | Fichier chargé dans Chrome Incognito ; interface Figma accessible et inscription proposée pour commenter, modifier ou inspecter. Accès anonyme également vérifié dans un second navigateur. |
| Charte : beige `#cfbd97` et noir `#000000` | Présence vérifiée dans la source | Couleurs vectorielles relevées sur la page d’accueil du PDF ; les rendus conservent les couleurs de la source. |
| Charte : police Poppins | À finaliser | Le FIG fourni référence Poppins et Inter. Contrôler les familles réellement utilisées et remplacer les textes non conformes dans Figma. |
| Liste des écrans | Réalisée | [32 planches inventoriées](MAQUETTES.md), avec rôle, fonction, image et dimensions. |
| Exports de la version fournie | Réalisés | 32 PNG lisibles, rendus à la taille native des pages du PDF ; inspection des quatre planches de contrôle. |
| Plats et boissons congolais | Demande reçue, modification à appliquer | [Contenus à remplacer](contenu-congolais.md), puis nouveaux exports et vérification des exemples de commandes. |
| Validation du propriétaire | Déclarée par Emmanuel pour la version initiale | Le nom du propriétaire, la date exacte de son accord et une référence datée restent à renseigner. |
| Validation de la version modifiée | À obtenir après modification | La confirmation de la version initiale ne valide pas automatiquement les nouveaux menus et les changements de police. |

Le 30 octobre 2026 est la date de préparation et de test du lien. Elle ne remplace pas la date de validation du propriétaire.

## Validation à consigner

- Propriétaire ayant validé : **Judbie**, selon la confirmation d’Emmanuel.
- Date de l’accord rapportée : **26 octobre 2026**.
- Version concernée : fichier Figma ci-dessus ; préciser la version après adaptation des menus.
- Trace de l’accord : confirmation explicite d’Emmanuel dans cette conversation, avec nom et date ; aucune trace externe datée fournie. La validation des adaptations ultérieures reste à obtenir.
- Résultat final E-4 : **en cours**.

## Points de cohérence issus d’E-3

Les maquettes fournies et les documents du dépôt présentent encore des différences à résoudre lors de la relecture :

- Le PDF annonce parfois les points après paiement, alors que les [règles de commande](../regles-commande-paiement.md) prévoient leur crédit à la commande terminée et une validité de 12 mois.
- Le panier complet et les trois retours de paiement restent des compléments présents dans les wireframes E-3 ; ils ne figurent pas comme quatre écrans complets dans les 32 pages fournies.
- L’invitation du premier administrateur et l’envoi d’un email doivent être rapprochés du mécanisme réellement retenu par l’équipe.
- Le périmètre de supervision du gérant et les actions disponibles doivent correspondre aux [rôles et permissions](../roles-permissions.md).

La relecture croisée et la fusion restent soumises aux [conventions Git](../conventions-git.md). La branche E-4 part de la branche E-3, dont la [PR #25](https://github.com/alfredoisasole-tech/mon-miam-miam-projet_integrateur/pull/25) est encore à fusionner au moment de la préparation.
