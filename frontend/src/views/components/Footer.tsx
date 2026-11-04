import React, { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

/**
 * Logo SVG officiel Mon Miam Miam (bol fumant doré sur fond noir)
 */
export const BrandLogoIcon: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <svg
    viewBox="0 0 100 100"
    width={size}
    height={size}
    aria-hidden="true"
    style={{ flexShrink: 0, borderRadius: '8px' }}
  >
    <rect x="5" y="5" width="90" height="90" rx="18" fill="#000000" />
    {/* Vapeurs */}
    <path d="M 36 26 C 34 20 42 16 39 12" stroke="#CFBD97" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    <path d="M 50 24 C 48 18 54 15 52 11" stroke="#CFBD97" strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M 64 26 C 62 20 70 16 67 12" stroke="#CFBD97" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    {/* Bol */}
    <path d="M 24 40 L 76 40 C 76 64 60 74 50 74 C 40 74 24 64 24 40 Z" fill="#CFBD97" />
    <rect x="21" y="37" width="58" height="5" rx="2.5" fill="#CFBD97" />
    <path d="M 42 74 L 38 80 L 62 80 L 58 74 Z" fill="#CFBD97" />
    {/* Visage souriant miam */}
    <path d="M 36 51 Q 41 46 45 51" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M 55 51 Q 59 46 64 51" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M 43 59 Q 50 66 57 59" stroke="#000000" strokeWidth="3" strokeLinecap="round" fill="none" />
  </svg>
);

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="shell-footer" role="contentinfo">
      {/* ── 1. Encart Newsletter & Call-To-Action (Top Footer) ── */}
      <section className="footer-newsletter" aria-labelledby="newsletter-heading">
        <div className="footer-newsletter__content">
          <div className="footer-newsletter__text">
            <span className="footer-eyebrow">Menus &amp; Bons Plans Campus</span>
            <h2 id="newsletter-heading" className="footer-newsletter__title">
              Recevez les plats du jour et les réductions du Miam Club
            </h2>
            <p className="footer-newsletter__desc">
              Le menu de midi de chaque restaurant du campus directement dans votre boîte mail dès 10h.
            </p>
          </div>

          <div className="footer-newsletter__form-wrap">
            {subscribed ? (
              <div className="footer-newsletter__success" role="status">
                ✓ Merci ! Vous êtes inscrit(e) aux alertes gourmandes du campus.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="footer-newsletter__form" noValidate>
                <label htmlFor="footer-email-input" className="sr-only">
                  Votre adresse e-mail universitaire ou personnelle
                </label>
                <input
                  id="footer-email-input"
                  type="email"
                  placeholder="votre.email@campus.cd"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="footer-newsletter__input"
                />
                <button type="submit" className="footer-newsletter__btn">
                  S'abonner
                </button>
              </form>
            )}
            <p className="footer-newsletter__rgpd">
              🔒 Vos données restent confidentielles et ne sont jamais cédées. Désinscription possible en 1 clic.
            </p>
          </div>
        </div>
      </section>

      {/* ── 2. Grille principale en 4 colonnes ── */}
      <div className="footer-grid">
        {/* Colonne 1 : Identité & Réassurance */}
        <div className="footer-col footer-col--brand">
          <div className="footer-brand-header">
            <BrandLogoIcon size={38} />
            <div>
              <span className="footer-brand-title">Mon Miam Miam</span>
              <span className="footer-brand-tagline">Restauration Campus</span>
            </div>
          </div>
          <p className="footer-col__desc">
            La plateforme de commande connectée des restaurants universitaires. Repas sur place, à emporter ou en livraison partout sur le campus.
          </p>

          <div className="footer-trust">
            <span className="footer-trust__label">Moyens de paiement acceptés :</span>
            <div className="footer-payment-badges" aria-label="Moyens de paiement partenaires">
              <span className="payment-pill" title="Airtel Money RDC">Airtel Money</span>
              <span className="payment-pill" title="M-Pesa Vodacom">M-Pesa</span>
              <span className="payment-pill" title="Orange Money">Orange Money</span>
              <span className="payment-pill" title="Carte Bancaire Visa / Mastercard">CB · Visa</span>
            </div>
          </div>

          <div className="footer-socials" aria-label="Nos canaux d'information">
            <span className="footer-social-link" title="Canal WhatsApp Campus">WhatsApp Campus</span>
            <span className="footer-social-link" title="Page Facebook Officielle">Facebook</span>
            <span className="footer-social-link" title="Instagram des Restaurants">Instagram</span>
          </div>
        </div>

        {/* Colonne 2 : Navigation Rapide (SEO & Découverte) */}
        <div className="footer-col" aria-label="Navigation rapide de la restauration">
          <h3 className="footer-col__title">Nos Restaurants</h3>
          <ul className="footer-links">
            <li><Link to="/">Accueil du campus</Link></li>
            <li><Link to="/menu">Carte des plats du jour</Link></li>
            <li><Link to="/menu">ZeDuc@Space (Grillades &amp; Plats)</Link></li>
            <li><Link to="/menu">Chez Léa (Bistro Campus)</Link></li>
            <li><Link to="/loyalty">Programme Fidélité Miam Club</Link></li>
            <li><Link to="/cart">Click &amp; Collect &amp; Livraison</Link></li>
          </ul>
        </div>

        {/* Colonne 3 : Espace Étudiant & Compte */}
        <div className="footer-col" aria-label="Espace étudiant et assistance">
          <h3 className="footer-col__title">Espace Étudiant</h3>
          <ul className="footer-links">
            <li><Link to="/login">Connexion à mon compte</Link></li>
            <li><Link to="/register">Créer un compte étudiant</Link></li>
            <li><Link to="/orders">Suivi de mes commandes en direct</Link></li>
            <li><Link to="/loyalty">Solde de points de fidélité</Link></li>
            <li><Link to="/orders">Déclarer une réclamation (SAV)</Link></li>
            <li><Link to="/conditions">Foire Aux Questions (FAQ)</Link></li>
          </ul>
        </div>

        {/* Colonne 4 : Informations Légales & Contact Direct */}
        <div className="footer-col footer-col--contact">
          <h3 className="footer-col__title">Contact &amp; Campus</h3>
          <address className="footer-address">
            <p className="footer-contact-item">
              <span className="footer-icon" aria-hidden="true">📍</span>
              <span>Campus Universitaire UNIKIN, Bâtiment Restauration Centrale, Kinshasa, RDC</span>
            </p>
            <p className="footer-contact-item">
              <span className="footer-icon" aria-hidden="true">🕒</span>
              <span>Service continu : Lun - Sam 08h00 – 22h00</span>
            </p>
            <p className="footer-contact-item">
              <span className="footer-icon" aria-hidden="true">📞</span>
              <a href="tel:+243810000000" className="footer-contact-link">+243 81 000 0000</a>
            </p>
            <p className="footer-contact-item">
              <span className="footer-icon" aria-hidden="true">✉️</span>
              <a href="mailto:support@monmiammiam.cd" className="footer-contact-link">support@monmiammiam.cd</a>
            </p>
          </address>

          <div className="footer-legal-links">
            <Link to="/conditions">Conditions d'Utilisation (CGU)</Link>
            <span aria-hidden="true">·</span>
            <Link to="/confidentialite">Politique de Confidentialité</Link>
            <span aria-hidden="true">·</span>
            <Link to="/cookies">Gestion des Cookies</Link>
          </div>
        </div>
      </div>

      {/* ── 3. Ligne finale : Copyright dynamique, devise & langue ── */}
      <div className="footer-bottom">
        <div className="footer-bottom__copy">
          © {currentYear} Mon Miam Miam · Vos repas sur le campus. Tous droits réservés.
        </div>

        <div className="footer-bottom__badges">
          <span className="footer-badge-item">Conformité RGPD &amp; RGAA</span>
          <span className="footer-separator" aria-hidden="true">|</span>
          <span className="footer-badge-item" title="Devise principale du restaurant">Devise : Franc Congolais (FC)</span>
          <span className="footer-separator" aria-hidden="true">|</span>
          <span className="footer-badge-item" title="Langue de l'interface">Langue : FR (Français)</span>
        </div>
      </div>
    </footer>
  );
};
