# E-5 — Charte graphique et composants de base

Branche : `feature/charte-composants`, issue du dernier `dev`. Responsable : Emmanuel Mboyo. Ticket : [APP-100](https://judbie2030-45660043.atlassian.net/browse/APP-100). La mise en page générale et la navigation par rôle restent dans E-6.

## Charte

Les couleurs sont centralisées dans `frontend/src/views/styles.css` : `--mm-color-primary` et `--mm-color-secondary`, leurs couleurs de texte, les surfaces et les états. Les composants utilisent les variables CSS ; ils ne contiennent aucune couleur en ligne. Les textes noirs sur le beige et blancs sur le noir restent lisibles. Les états disposent aussi de libellés textuels.

Poppins est embarquée avec ses graisses 400, 500, 600 et 700 et `font-display: swap`. Les fichiers proviennent du [dépôt officiel Google Fonts](https://github.com/google/fonts/tree/main/ofl/poppins) et leur licence SIL Open Font License figure dans `frontend/src/assets/fonts/OFL.txt`. Le navigateur n’appelle aucun service de polices externe.

La feuille de styles est importée dans `src/main.tsx`. Les grilles passent sur une colonne sur téléphone, les champs peuvent rétrécir, les onglets défilent dans leur propre zone et le focus clavier reste visible. Le spinner respecte la préférence de réduction des animations.

## API commune

Importer depuis `frontend/src/views/components/ui.tsx`. Ces interfaces sont partagées : prévenir les autres binômes dans la PR avant toute modification incompatible. Les props existantes du brouillon sont conservées ; `Badge` et le contenu des onglets sont ajoutés.

| Composant | Props | Comportement |
| --- | --- | --- |
| `Alert` | `kind?: 'error' \| 'success' \| 'info'`, `children` | Erreur annoncée par `alert`, autres messages par `status`. Aucun conteneur si le message est absent. |
| `Spinner` | `label?: string` | Indicateur animé avec nom accessible et texte visible. |
| `Field` | `label`, `hint?`, `error?`, `children` | Un seul contrôle React qui transmet `id` et `aria-*` à son élément natif. Libellé et descriptions reliés automatiquement. |
| `Input` | Props natives d’`input` + `label`, `hint?`, `error?` | Valeur contrôlée ou non contrôlée, événements et attributs natifs préservés. |
| `Select` | Props natives de `select` + `label`, `hint?`, `error?`, options enfants | Même association accessible que l’input. |
| `Card` | `title?`, `actions?`, `children` | Section nommée par son titre, avec zone d’actions facultative. |
| `Badge` | `kind?: 'error' \| 'success' \| 'info' \| 'neutral'`, `children` | Statut textuel ; variante `info` par défaut. |
| `Tabs<T>` | `value`, `options: { id: T; label: string; content?: ReactNode }[]`, `onChange`, `label?` | Contrôlé par le parent. Flèches gauche/droite, Début et Fin activent et focalisent les onglets. Les panneaux fournis via `content` sont reliés et masqués selon la sélection. |
| `Empty` | `children` | Message vide pouvant contenir une action de reprise. |

Utiliser un `id` unique si vous le fournissez ; sinon `Field` le génère. Les descriptions déjà présentes dans `aria-describedby` sont conservées. Une erreur ajoute `aria-invalid` et un `aria-errormessage` pointant vers le message. L’application reste responsable de sa validation métier et de l’annonce des erreurs apparues après soumission.

Les appels `Tabs` du brouillon sans `content` gardent leurs props et leur rendu d’onglets ; leur contenu reste géré à l’extérieur. Préférer `content` pour bénéficier des panneaux ARIA intégrés. Les valeurs des options doivent être uniques et `value` doit correspondre à une option.

```tsx
<Input label="Adresse e-mail" type="email" required error={errors.email} />
<Select label="Restaurant" value={restaurantId} onChange={onRestaurantChange}>
  <option value="campus">Restaurant du campus</option>
</Select>
<Tabs label="Menu" value={category} onChange={setCategory} options={[
  { id: 'plats', label: 'Plats', content: <p>La carte des plats</p> },
  { id: 'boissons', label: 'Boissons', content: <p>La carte des boissons</p> },
]} />
```

## Aperçu et vérifications

Depuis `frontend/` :

```sh
npm ci
npm test
npm run build
npm run dev
```

Ouvrir `/ui.html` sur le serveur Vite pour parcourir les composants. Cet aperçu de développement est indépendant de la page d’accueil et n’est pas une route métier. `ui.test.tsx` couvre chaque composant, les associations accessibles des champs, le retrait des erreurs, l’unicité des identifiants, les actions et la navigation clavier des onglets sans soumettre le formulaire.


Résultats du 1er novembre 2026 : **56 tests frontend réussis**, dont 10 tests des composants ; typage et construction réussis. Aperçu vérifié dans le navigateur à 1 280 px et à 360 px : aucune largeur de document supérieure à la fenêtre, grille sur une colonne sur téléphone, Poppins chargée, couleurs attendues et navigation clavier des onglets vérifiées. Aucune erreur dans la console de l’aperçu. Ces contrôles ne constituent pas un audit d’accessibilité exhaustif.

[Aperçu ordinateur](ui/desktop.png) · [Aperçu téléphone](ui/mobile.png).

Commandes Git utilisées, depuis la racine du dépôt (ajouter seulement les fichiers E-5 nommés) :

```sh
git fetch origin dev
git switch -c feature/charte-composants origin/dev
git add frontend/src/views/styles.css frontend/src/views/components/ui.tsx frontend/src/test/ui.test.tsx
git add frontend/src/main.tsx frontend/ui.html frontend/src/ui-preview.tsx
git add frontend/src/assets/fonts/Poppins-Regular.ttf frontend/src/assets/fonts/Poppins-Medium.ttf frontend/src/assets/fonts/Poppins-SemiBold.ttf frontend/src/assets/fonts/Poppins-Bold.ttf frontend/src/assets/fonts/OFL.txt
git add docs/ui.md docs/ui/desktop.png docs/ui/mobile.png
git commit -m "feat(ui): ajouter la charte et les composants de base (APP-100)"
git push -u origin feature/charte-composants
```

La PR vise `dev` et commence par `APP-100`. Sa fusion attend la relecture d’un autre binôme et les contrôles GitHub.
