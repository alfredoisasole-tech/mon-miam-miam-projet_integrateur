# Scénarios de test du parcours étudiant (Binôme B)

Ce document décrit les scénarios de test de bout en bout pour valider l'espace étudiant de l'application Mon Miam Miam.

## Prérequis
- Backend et frontend lancés en local (`npm run seed`, `npm start`, `npm run dev`).
- Compte étudiant de test (ex: `etudiant@test.com` / `Password123`).
- Restaurant actif (ex: `zeduc-space`).

## Scénario 1 : Inscription et Connexion
1. **Action** : Aller sur la page d'inscription.
2. **Saisie** : Nom, email unique, téléphone (+243...), mot de passe (1 majuscule, 1 chiffre).
3. **Vérification** : Le compte est créé, l'utilisateur est automatiquement connecté et redirigé vers l'accueil/menu.
4. **Action** : Se déconnecter, puis se reconnecter avec les identifiants.
5. **Vérification** : La connexion réussit et le nom de l'utilisateur s'affiche.

## Scénario 2 : Choix du restaurant et Consultation du menu
1. **Action** : Sur la page d'accueil, cliquer sur un restaurant (ex: ZeDuc@Space).
2. **Vérification** : Les couleurs de l'application s'adaptent à la charte du restaurant.
3. **Vérification** : Le menu s'affiche, trié par catégories, avec les "Plats du jour" en tête.
4. **Vérification** : Les promotions actives s'affichent en haut du menu (si disponibles).

## Scénario 3 : Composition du panier et Commande
1. **Action** : Cliquer sur "Ajouter" sur un plat (en tant qu'étudiant connecté).
2. **Vérification** : Le compteur du panier s'incrémente.
3. **Action** : Aller dans le panier. Modifier les quantités (+/-).
4. **Vérification** : Le total se met à jour dynamiquement.
5. **Action** : Choisir "Sur place" et sélectionner une heure d'arrivée (ou "Livraison" et choisir une commune).
6. **Vérification** : Le formulaire de livraison affiche bien la liste des communes de Kinshasa.

## Scénario 4 : Paiement et Utilisation des points de fidélité
1. **Action** : Dans le panier, cocher "Utiliser mes points" (si le solde >= 15 points).
2. **Vérification** : Une réduction de 3 000 FC (plafonnée au total) s'applique sur le total à payer.
3. **Action** : Choisir le mode de paiement "Mobile Money".
4. **Action** : Cliquer sur "Confirmer la commande".
5. **Vérification** : Redirection vers la page de simulation de paiement.
6. **Action** : Cliquer sur "Simuler un Paiement Réussi".
7. **Vérification** : Le message "Paiement reçu" s'affiche, et la commande passe au statut "En préparation".

## Scénario 5 : Suivi de commande et Historique
1. **Action** : Aller dans "Mes commandes".
2. **Vérification** : La commande apparaît avec le statut "En préparation" ou "Prête".
3. **Action** : Attendre que le personnel (compte employé) change le statut en "Terminée".
4. **Vérification** : Le statut se met à jour automatiquement (refresh) côté étudiant.
5. **Vérification** : Le solde de points de fidélité a augmenté (1 point par tranche de 3 000 FC dépensés).

## Scénario 6 : Gestion des erreurs et Cas limites
1. **Action** : Tenter de s'inscrire avec un email déjà utilisé.
2. **Vérification** : Message d'erreur clair "Un compte existe déjà".
3. **Action** : Tenter de commander un plat "Épuisé" (via manipulation API).
4. **Vérification** : Le serveur refuse la commande (400/409) et le panier ne se vide pas.
