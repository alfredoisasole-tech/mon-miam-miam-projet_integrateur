# E-6 — Mise en page et navigation par rôle

Responsable : Emmanuel Mboyo. Ticket : [APP-101](https://judbie2030-45660043.atlassian.net/browse/APP-101). Branche : `feature/mise-en-page`.

## Dépendance et intégration

E-6 utilise les composants et la charte d’[E-5, PR #35](https://github.com/alfredoisasole-tech/mon-miam-miam-projet_integrateur/pull/35). La branche part donc de `feature/charte-composants`. La PR vise temporairement cette branche pour montrer uniquement E-6. Après fusion d’E-5 dans `dev`, changer sa base vers `dev` et vérifier à nouveau les contrôles avant fusion. Cette dépendance est signalée dans la description de PR ; elle ne vaut pas approbation d’E-5.

`Layout` s’utilise à l’intérieur de `BrowserRouter`, `AuthProvider` et `RestaurantProvider`. Il accepte `children` ou rend l’`Outlet` du routeur. `LayoutView` expose la vue seule pour les aperçus et les tests : `role?`, `loading?`, `restaurant?`, `onLogout`, `children?`.

L’application monte désormais ces fournisseurs et le layout. L’accueil et le menu existant sont raccordés. Les autres destinations sont réservées aux tâches métier de l’équipe ; elles affichent pour l’instant une page indisponible avec retour à l’accueil. E-6 ne simule ni connexion, ni paiement, ni statistiques.

## Navigation

| Rôle | Liens |
| --- | --- |
| Visiteur | Accueil `/`, Connexion `/login`, Inscription `/register` |
| Étudiant | Menu `/menu`, Panier `/cart`, Mes commandes `/orders`, Mes points `/loyalty` |
| Employé | Commandes `/staff/orders`, Menu `/staff/menu`, Statistiques `/staff/weekly` |
| Gérant | Commandes `/staff/orders`, Menu `/staff/menu`, Statistiques `/staff/overview` |
| Administrateur restaurant | Commandes `/staff/orders`, Menu `/admin/menu`, Statistiques `/staff/overview` |
| Administrateur plateforme | Restaurants `/plateforme` |

Les personnes connectées disposent d’un bouton Déconnexion : il appelle le contrôleur de session existant, ferme le menu et remplace l’adresse courante par l’accueil. Pendant la restauration de session, les liens sont remplacés par un indicateur de chargement. Le rôle `platform_admin`, déjà prévu au contrat d’authentification, est ajouté à l’union `User.role` sans changer les autres rôles.

Masquer un lien n’est pas une protection d’accès : les futures pages privées doivent rester entourées du composant `RequireRole`, et les permissions ainsi que l’isolation des restaurants restent vérifiées par l’API.

## Restaurant et accessibilité

Le contrôleur `useRestaurantProfile` charge `GET /restaurants/:slug` via le client HTTP existant. Le nom et les couleurs proviennent de ce profil public. Un changement de sélection ignore les réponses tardives du restaurant précédent. Une erreur affiche un message et conserve l’identité générique ; la plateforme conserve toujours sa propre identité.

Seules les couleurs hexadécimales à six chiffres sont acceptées. Le texte de l’en-tête et des boutons est choisi clair ou sombre à partir de la luminance de la couleur. Les styles statiques utilisent les variables de la charte E-5 ; les couleurs issues de l’API sont des données appliquées dans des propriétés CSS locales au layout.

Le menu mobile se replie sous 760 px. Son bouton expose `aria-expanded` et `aria-controls`. Échap le ferme et rend le focus au bouton ; une navigation le referme également. Les liens actifs utilisent `aria-current`. Le layout possède un en-tête, une navigation nommée, un seul contenu principal, un pied de page et un lien d’évitement vers le contenu.

## Vérifications

Le 1er novembre 2026 : **69 tests frontend réussis**, dont 11 tests du layout et 2 tests du profil restaurant ; typage TypeScript et build Vite réussis. Vérification dans le navigateur à 1 280 px et 360 px : menu mobile fermé puis ouvert, fermeture par Échap, absence de débordement horizontal, liens plateforme isolés, aucune erreur console dans l’aperçu.

[Capture ordinateur](layout/desktop.png) · [Capture mobile](layout/mobile.png).

```sh
cd frontend
npm test
npm run build
npm run dev
```

Ouvrir `/layout.html` pour comparer les six rôles dans un aperçu de développement avec données fictives. L’aperçu ne modifie pas la session réelle.

Commandes Git de livraison :

```sh
git switch feature/charte-composants
git switch -c feature/mise-en-page
# Ajouter individuellement les fichiers E-6 avant le commit.
git commit -m "feat(ui): ajouter la mise en page et la navigation par rôle (APP-101)"
git push -u origin feature/mise-en-page
```
