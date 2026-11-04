import { Link } from 'react-router-dom';

export type LegalKind = 'mentions' | 'confidentialite' | 'conditions';

export const LEGAL_LINKS: Array<[LegalKind, string, string]> = [
  ['mentions', '/legal/mentions', 'Mentions légales'],
  ['confidentialite', '/legal/confidentialite', 'Confidentialité'],
  ['conditions', '/legal/conditions', 'Conditions d’utilisation'],
];

export function LegalPage({ page }: { page: LegalKind }) {
  if (page === 'mentions') return <article>
    <h1>Mentions légales</h1>
    <h2>Éditeur</h2>
    <p>Mon Miam Miam est un projet intégrateur réalisé par une équipe d’étudiants à Kinshasa (République démocratique du Congo). Il n’est pas, à ce jour, exploité par une société commerciale.</p>
    <h2>Responsable du projet</h2>
    <p>Alfredo Isasole, responsable technique de l’équipe.</p>
    <h2>Hébergement</h2>
    <p>Le site et son serveur sont hébergés par un prestataire d’hébergement web ; ses coordonnées sont communiquées sur demande à l’équipe.</p>
    <h2>Restaurants</h2>
    <p>Chaque restaurant partenaire reste responsable de ses plats, de ses prix, de ses horaires et de la qualité de ses repas.</p>
    <h2>Propriété</h2>
    <p>Le nom, la charte graphique et le code du site sont la propriété de l’équipe du projet. Les images et logos des restaurants appartiennent à leurs restaurants.</p>
  </article>;

  if (page === 'confidentialite') return <article>
    <h1>Politique de confidentialité</h1>
    <h2>Données collectées</h2>
    <p>Votre nom, votre adresse e-mail, votre numéro de téléphone, votre mot de passe (conservé sous forme chiffrée, jamais lisible), vos commandes, vos points de fidélité, vos réclamations et votre code de parrainage.</p>
    <h2>À quoi elles servent</h2>
    <p>À préparer et livrer vos commandes, à calculer vos points, à traiter vos réclamations et à vous permettre de vous reconnecter. Elles ne sont ni vendues ni utilisées pour de la publicité.</p>
    <h2>Qui les voit</h2>
    <p>Seuls les restaurants dont vous êtes client voient vos commandes et votre nom. Dans les classements, votre nom est abrégé (prénom et initiale).</p>
    <h2>Cookies et stockage</h2>
    <p>Le site garde dans votre navigateur votre connexion, votre panier et votre choix sur cette bannière. Aucun cookie publicitaire ou de suivi n’est utilisé.</p>
    <h2>Vos droits</h2>
    <p>Depuis la page <Link to="/profile">Mon profil</Link>, vous pouvez exporter vos données dans un fichier et supprimer votre compte. À la suppression, vos informations personnelles sont effacées ; seuls les montants et les dates des commandes sont conservés pour la comptabilité des restaurants. Pour supprimer votre compte, aucune commande ne doit être en cours.</p>
  </article>;

  return <article>
    <h1>Conditions générales d’utilisation</h1>
    <h2>Compte</h2>
    <p>Un compte unique vous donne accès à tous les restaurants. Vous êtes responsable de la confidentialité de votre mot de passe.</p>
    <h2>Commandes et paiement</h2>
    <p>Une commande est validée après le paiement choisi. Les prix sont indiqués en francs congolais (FC). Un restaurant peut refuser ou annuler une commande qu’il ne peut pas préparer ; vous en êtes alors informé.</p>
    <h2>Points de fidélité</h2>
    <p>Les points gagnés dans un restaurant ne servent que dans ce restaurant. Les règles (dépense pour un point, points nécessaires pour une réduction, durée de validité) sont fixées par chaque restaurant et affichées sur la page Mes points.</p>
    <h2>Réclamations</h2>
    <p>Vous pouvez déposer une réclamation sur une commande ou sur des points. Elle est examinée par le personnel du restaurant, puis validée par son gérant ou, pour les points, par l’administrateur.</p>
    <h2>Comportement</h2>
    <p>Tout usage abusif (fausses réclamations, tentatives de fraude, parrainages fictifs) peut entraîner la suspension du compte.</p>
  </article>;
}
