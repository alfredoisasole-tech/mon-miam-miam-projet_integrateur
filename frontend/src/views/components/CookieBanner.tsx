import { useState } from 'react';
import { Link } from 'react-router-dom';
import './cookies.css';

const KEY = 'mmm_cookies';

function readChoice(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/** Le site n'utilise aucun cookie de suivi : le choix est simplement mémorisé sur l'appareil. */
export function CookieBanner() {
  const [choice, setChoice] = useState<string | null>(readChoice);
  if (choice) return null;
  function decide(value: 'accepted' | 'refused') {
    try { localStorage.setItem(KEY, value); } catch { /* stockage indisponible : le choix vaut pour cette visite */ }
    setChoice(value);
  }
  return <section className="cookie-banner" role="region" aria-label="Cookies">
    <p>Mon Miam Miam utilise le stockage de votre navigateur pour garder votre connexion et votre panier. Aucun suivi publicitaire n’est utilisé. <Link to="/legal/confidentialite">Politique de confidentialité</Link></p>
    <div className="cookie-actions">
      <button type="button" className="btn" onClick={() => decide('refused')}>Refuser</button>
      <button type="button" className="btn btn-primary" onClick={() => decide('accepted')}>Accepter</button>
    </div>
  </section>;
}
