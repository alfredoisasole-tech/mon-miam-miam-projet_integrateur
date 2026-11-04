import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useRestaurant } from '../../controllers/session.tsx';
import { useCart } from '../../controllers/useCart.ts';
import { useRestaurantProfile } from '../../controllers/useRestaurantProfile.ts';
import type { RestaurantBrand } from '../../controllers/useRestaurantProfile.ts';
import type { User } from '../../models/types.ts';
import { assetUrl } from '../../models/http.ts';
import { Alert, Spinner } from './ui.tsx';
import { CookieBanner } from './CookieBanner.tsx';
import { LEGAL_LINKS } from '../pages/LegalPage.tsx';
import './layout.css';

const publicLinks = [['/', 'Accueil'], ['/login', 'Connexion'], ['/register', 'Inscription']];
function linksFor(role: User['role']) {
  switch (role) {
    case 'student': return [['/', 'Restaurants'], ['/menu', 'Menu'], ['/cart', 'Panier'], ['/orders', 'Mes commandes'], ['/loyalty', 'Mes points'], ['/community', 'Communauté'], ['/claims', 'Réclamations']];
    case 'employee': return [['/staff/orders', 'Commandes'], ['/staff/menu', 'Menu'], ['/staff/weekly', 'Statistiques'], ['/staff/claims', 'Réclamations']];
    case 'manager': return [['/staff/orders', 'Commandes'], ['/staff/menu', 'Menu'], ['/staff/overview', 'Statistiques'], ['/staff/claims', 'Réclamations'], ['/staff/accounts', 'Équipe']];
    case 'admin': return [['/staff/orders', 'Commandes'], ['/admin/menu', 'Menu'], ['/staff/overview', 'Statistiques'], ['/staff/claims', 'Réclamations'], ['/staff/accounts', 'Équipe'], ['/admin/promotions', 'Promotions'], ['/admin/settings', 'Paramètres']];
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
  /** Page de la plateforme (accueil, compte, pages légales) : charte fixe, jamais celle d'un restaurant. */
  platformStyle?: boolean;
  /** Nombre d'articles du panier, affiché sur le lien « Panier » des étudiants. */
  cartCount?: number;
  children?: ReactNode;
}

/** Pages de la plateforme : charte fixe. Le reste (menu, panier, commandes, points, personnel…) prend la charte du restaurant. */
const PLATFORM_PATHS = new Set(['/', '/login', '/register', '/forgot-password', '/profile', '/plateforme']);
export const isPlatformPage = (pathname: string) => PLATFORM_PATHS.has(pathname) || pathname.startsWith('/legal');

/** Revient en haut de page à chaque changement de page, comme sur un site classique. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo?.(0, 0); }, [pathname]);
  return null;
}

/** Vue partagée, sans appel API ; Layout raccorde la session et le profil public. */
export function LayoutView({ role, loading = false, restaurant, onLogout, cartCount = 0, platformStyle = false, children }: LayoutViewProps) {
  const location = useLocation();
  const navId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === location.key;
  const platform = role === 'platform_admin';
  // La plateforme a sa propre charte, fixe : elle ne dépend jamais de celle d'un restaurant.
  const fixed = platform || platformStyle;
  const brand = platform ? 'Mon Miam Miam · Plateforme' : fixed ? 'Mon Miam Miam' : restaurant?.name ?? 'Mon Miam Miam';
  const mode = !fixed && restaurant?.defaultMode && MODES.includes(restaurant.defaultMode) ? restaurant.defaultMode : 'light';
  const logo = !fixed && restaurant?.logoUrl ? restaurant.logoUrl : null;
  return <div className="app-shell" data-mode={fixed ? undefined : mode} style={fixed ? undefined : themeFor(restaurant)}>
    <ScrollToTop />
    <a className="skip-link" href="#main-content">Aller au contenu</a>
    <header className="topbar">
      <Link to={platform ? '/plateforme' : '/'} className="brand">{logo && <img className="brand-logo" src={assetUrl(logo)} alt={brand} />}{!logo && fixed && <img className="brand-mark" src="/mon-miam-miam.svg" alt="" />}{!logo && brand}</Link>
      {role === 'student' && cartCount > 0 && <Link to="/cart" className="cart-shortcut" aria-label={`Voir le panier, ${cartCount} ${cartCount > 1 ? 'articles' : 'article'}`}>
        Panier <span className="nav-badge" aria-hidden="true">{cartCount}</span>
      </Link>}
      {loading ? <Spinner label="Chargement de la session…" /> : <>
        <button ref={toggle} className="burger" type="button" aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open} aria-controls={navId} onClick={() => setOpenedAt(open ? null : location.key)}>☰</button>
        <nav id={navId} className={`main-nav${open ? ' open' : ''}`} aria-label="Navigation principale" onKeyDown={event => {
          if (event.key === 'Escape') { setOpenedAt(null); toggle.current?.focus(); }
        }}>
          {linksFor(role).map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpenedAt(null)}>
            {label}
            {to === '/cart' && cartCount > 0 && <span className="nav-badge" aria-label={`${cartCount} ${cartCount > 1 ? 'articles' : 'article'}`}>{cartCount}</span>}
          </NavLink>)}
          {role && <button type="button" className="logout" onClick={() => { setOpenedAt(null); onLogout(); }}>Déconnexion</button>}
        </nav>
      </>}
    </header>
    <main id="main-content" className="content shell-content" tabIndex={-1}>{children ?? <Outlet />}</main>
    <footer className="shell-footer">
      <nav className="footer-links" aria-label="Informations légales">
        {role && !platform && <Link to="/profile">Mon profil</Link>}
        {LEGAL_LINKS.map(([key, to, label]) => <Link key={key} to={to}>{label}</Link>)}
      </nav>
      © {new Date().getFullYear()} Mon Miam Miam · Vos repas sur le campus
    </footer>
    <CookieBanner />
  </div>;
}

export function Layout({ children }: { children?: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { slug } = useRestaurant();
  // Le personnel voit la charte de son restaurant ; un étudiant, celle du restaurant qu'il consulte.
  const platformPage = isPlatformPage(useLocation().pathname);
  const { restaurant, error } = useRestaurantProfile(platformPage || user?.role === 'platform_admin' ? null : (user?.restaurant?.slug ?? slug));
  const navigate = useNavigate();
  const { count } = useCart();
  return <LayoutView role={user?.role} loading={loading} restaurant={restaurant} cartCount={count} platformStyle={platformPage} onLogout={() => { logout(); navigate('/', { replace: true }); }}>
    {error && <Alert kind="info">{error}</Alert>}
    {children ?? <Outlet />}
  </LayoutView>;
}
