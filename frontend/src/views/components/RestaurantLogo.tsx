import { assetUrl } from '../../models/http.ts';

interface RestaurantLogoProps {
  name: string;
  logoUrl?: string | null;
  primary?: string;
  secondary?: string;
}

/** Logo d'un restaurant, ou à défaut une pastille à sa couleur avec son initiale. Décoratif : le nom est écrit à côté. */
export function RestaurantLogo({ name, logoUrl, primary, secondary }: RestaurantLogoProps) {
  if (logoUrl) return <img className="restaurant-logo" src={assetUrl(logoUrl)} alt="" loading="lazy" />;
  return <span className="restaurant-monogram" aria-hidden="true" style={{ background: primary ?? 'var(--mm-brand)', color: secondary ?? 'var(--mm-on-brand)' }}>
    {name.trim().charAt(0).toUpperCase()}
  </span>;
}
