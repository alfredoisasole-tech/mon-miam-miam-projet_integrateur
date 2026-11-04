import { useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useRestaurant } from '../../controllers/session.tsx';
import { useRestaurantProfile } from '../../controllers/useRestaurantProfile.ts';
import type { RestaurantBrand } from '../../controllers/useRestaurantProfile.ts';
import type { User } from '../../models/types.ts';
import { assetUrl } from '../../models/http.ts';
import { Alert, Spinner } from './ui.tsx';
import './layout.css';

const publicLinks = [['/', 'Accueil'], ['/login', 'Connexion'], ['/register', 'Inscription']];
function linksFor(role: User['role']) {
  switch (role) {
    case 'student': return [['/menu', 'Menu'], ['/cart', 'Panier'], ['/orders', 'Mes commandes'], ['/loyalty', 'Mes points']];
    case 'employee': return [['/staff/orders', 'Commandes'], ['/staff/menu', 'Menu'], ['/staff/weekly', 'Statistiques']];
    case 'manager': return [['/staff/orders', 'Commandes'], ['/staff/menu', 'Menu'], ['/staff/overview', 'Statistiques']];
    case 'admin': return [['/staff/orders', 'Commandes'], ['/admin/menu', 'Menu'], ['/staff/overview', 'Statistiques']];
    case 'platform_admin': return [['/plateforme', 'Restaurants']];
    default: return publicLinks;
  }
}
function onColor(color: string) {
  const channels = color.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  return luminance > .179 ? 'var(--mm-color-secondary)' : 'var(--mm-color-on-secondary)';
}
const FONTS = ['Poppins', 'Arial', 'Verdana', 'Trebuchet MS', 'Georgia', 'Tahoma', 'Times New Roman'];
const MODES = ['light', 'dark', 'system'];
function themeFor(restaurant?: RestaurantBrand | null): CSSProperties {
  const style: Record<string, string> = {};
  const primary = restaurant?.colors?.primary;
  const secondary = restaurant?.colors?.secondary;
  if (primary && /^#[\da-f]{6}$/i.test(primary)) {
    style['--mm-brand'] = primary;
    style['--mm-on-brand'] = onColor(primary);
  }
  if (secondary && /^#[\da-f]{6}$/i.test(secondary)) {
    style['--mm-header-bg'] = secondary;
    style['--mm-on-header'] = onColor(secondary);
  }
  if (restaurant?.fontFamily && FONTS.includes(restaurant.fontFamily)) {
    style['--mm-font-family'] = `'${restaurant.fontFamily}', 'Segoe UI', system-ui, sans-serif`;
  }
  return style as CSSProperties;
}

export interface LayoutViewProps {
  role?: User['role'];
  loading?: boolean;
  restaurant?: RestaurantBrand | null;
  onLogout: () => void;
  children?: ReactNode;
}

/** Vue partagée, sans appel API ; Layout raccorde la session et le profil public. */
export function LayoutView({ role, loading = false, restaurant, onLogout, children }: LayoutViewProps) {
  const location = useLocation();
  const navId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === location.key;
  const platform = role === 'platform_admin';
  const brand = platform ? 'Mon Miam Miam · Plateforme' : restaurant?.name ?? 'Mon Miam Miam';
  const mode = !platform && restaurant?.defaultMode && MODES.includes(restaurant.defaultMode) ? restaurant.defaultMode : 'light';
  const logo = !platform && restaurant?.logoUrl ? restaurant.logoUrl : null;
  return <div className="app-shell" data-mode={platform ? undefined : mode} style={platform ? undefined : themeFor(restaurant)}>
    <a className="skip-link" href="#main-content">Aller au contenu</a>
    <header className="topbar">
      <Link to={platform ? '/plateforme' : '/'} className="brand">{logo && <img className="brand-logo" src={assetUrl(logo)} alt={brand} />}{!logo && brand}</Link>
      {loading ? <Spinner label="Chargement de la session…" /> : <>
        <button ref={toggle} className="burger" type="button" aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open} aria-controls={navId} onClick={() => setOpenedAt(open ? null : location.key)}>☰</button>
        <nav id={navId} className={`main-nav${open ? ' open' : ''}`} aria-label="Navigation principale" onKeyDown={event => {
          if (event.key === 'Escape') { setOpenedAt(null); toggle.current?.focus(); }
        }}>
          {linksFor(role).map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpenedAt(null)}>{label}</NavLink>)}
          {role && <button type="button" className="logout" onClick={() => { setOpenedAt(null); onLogout(); }}>Déconnexion</button>}
        </nav>
      </>}
    </header>
    <main id="main-content" className="content shell-content" tabIndex={-1}>{children ?? <Outlet />}</main>
    <footer className="shell-footer">© {new Date().getFullYear()} Mon Miam Miam · Vos repas sur le campus</footer>
  </div>;
}

export function Layout({ children }: { children?: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { slug } = useRestaurant();
  const { restaurant, error } = useRestaurantProfile(user?.role === 'platform_admin' ? null : slug);
  const navigate = useNavigate();
  return <LayoutView role={user?.role} loading={loading} restaurant={restaurant} onLogout={() => { logout(); navigate('/', { replace: true }); }}>
    {error && <Alert kind="info">{error}</Alert>}
    {children ?? <Outlet />}
  </LayoutView>;
}
