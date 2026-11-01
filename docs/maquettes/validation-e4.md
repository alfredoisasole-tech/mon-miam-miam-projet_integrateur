# Contrôles et validation — E-4

Contrôle du 1er novembre 2026. Responsable : Emmanuel Mboyo. Branche : `docs/maquettes-validees`. Ticket : [APP-99](https://judbie2030-45660043.atlassian.net/browse/APP-99). PR : [#32](https://github.com/alfredoisasole-tech/mon-miam-miam-projet_integrateur/pull/32).

## Résultats

| Critère | Résultat | Preuve |
| --- | --- | --- |
| Fichier éditable d’Emmanuel | Réalisé | [Copie E-4](https://www.figma.com/design/mnn8o6VMsuz24FWleKDdlm/Mon-Miam-Miam?node-id=56-5451) ; la source de Judbie reste distincte |
| Couleurs beige et noir | Conservées | `#cfbd97` et `#000000`, charte source et exports |
| Poppins | Réalisé | 4 701 segments de texte de Page 1 contrôlés en Poppins ; [rapport Figma](rapport-figma-e4.json) |
| Plats congolais et photos | Réalisé | Poulet mayonnaise, Fumbwa, Riz aux haricots, Pondu ; cartes, miniatures et promotions mises à jour |
| Trois boissons illustrées | Réalisé | Coca-Cola, Fanta, Vital’O ; section Boissons, prix de démonstration 800 FC |
| Liste et exports | Réalisé | [32 planches](MAQUETTES.md), export PNG direct 1x ; identifiants, dimensions et SHA-256 dans l’inventaire |
| Contrôle visuel | Réalisé | Parcours des quatre planches de contrôle couvrant les 32 exports ; menu vérifié en détail, correction des photos initialement masquées |
| Lecture sans compte | Réussi le 1er novembre | Nouvelle fenêtre Chrome Incognito, sans session Figma ; menu modifié et trois photos de boissons visibles ; [capture](test-lecture-publique.png) |
| Synchronisation | Modifications observées publiquement | Le menu modifié est visible depuis la fenêtre privée indépendante ; les exports restent sauvegardés localement |
| Validation initiale du propriétaire | Rapportée par Emmanuel | Judbie, le **26 octobre 2026** ; aucune trace externe datée fournie |
| Approbation de la version modifiée | En attente | Relecture de Judbie nécessaire après les adaptations du 1er novembre |
| Relecture et fusion GitHub | En attente | Autre membre d’un autre binôme, CI si présente, puis fusion selon les conventions Git |

## Portée de la validation

La date du 26 octobre correspond à l’accord initial rapporté par Emmanuel. Elle précède les modifications des plats, boissons et polices. La préparation graphique et les exports ne permettent pas de déclarer à la place de Judbie que cette nouvelle version est approuvée. E-4 est livrée pour relecture ; sa clôture dépend de cet accord.

## Points à examiner pendant la relecture

- Les règles de fidélité de certains textes de la source restent à rapprocher des [règles de commande](../regles-commande-paiement.md) : crédit à la commande terminée et validité de 12 mois.
- Le panier complet et les retours de paiement sont des compléments des wireframes E-3 ; ils ne constituent pas quatre nouveaux écrans couleur dans ce lot de 32 planches.
- Les rôles, invitations et actions de supervision doivent être confirmés avec les [permissions](../roles-permissions.md) retenues par l’équipe.
- Les prix, variantes et illustrations générées des boissons restent des exemples de maquette, sans validation commerciale.

La fusion suit les [conventions Git](../conventions-git.md), avec une relecture croisée et celle du propriétaire des maquettes.
