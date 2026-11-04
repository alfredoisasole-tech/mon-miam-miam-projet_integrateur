import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, RestaurantProvider } from '../controllers/session.tsx';
import { api } from '../models/http.ts';
import { authApi } from '../models/api.ts';
import { HomePage, homeFor } from '../views/pages/HomePage.tsx';
import { LoginPage } from '../views/pages/LoginPage.tsx';
import { RegisterPage } from '../views/pages/RegisterPage.tsx';
import { Layout, LayoutView } from '../views/components/Layout.tsx';
import { CartProvider } from '../controllers/cart.tsx';
import { normalizePhone } from '../models/phone.ts';
import { authApi as registrationApi } from '../models/authApi.ts';

const restaurants = { items: [
  { slug: 'chez-lea', name: 'Chez Léa', slogan: null, logoUrl: null, colors: { primary: '#cfbd97', secondary: '#000000' }, isOpenNow: true },
  { slug: 'zeduc-space', name: 'ZeDuc@Space', slogan: null, logoUrl: null, colors: { primary: '#cfbd97', secondary: '#000000' }, isOpenNow: true },
], total: 2, page: 1, pageSize: 20 };

function asRole(role: string | null, withToken = true) {
  if (role && withToken) localStorage.setItem('mmm_token', 'fake-token');
  vi.spyOn(api, 'get').mockImplementation(async (path: string) => (path === '/me'
    ? { id: 'u1', name: 'Alex', email: 'alex@example.com', role }
    : restaurants) as never);
}
const routes = (initial: string) => render(
  <MemoryRouter initialEntries={[initial]}>
    <AuthProvider><RestaurantProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/r/:slug/menu" element={<p>Page du menu</p>} />
        <Route path="/staff/orders" element={<p>Tableau de bord du personnel</p>} />
        <Route path="/plateforme" element={<p>Espace plateforme</p>} />
        <Route path="/legal/conditions" element={<p>Conditions d’utilisation</p>} />
        <Route path="/legal/confidentialite" element={<p>Politique de confidentialité</p>} />
      </Routes>
    </RestaurantProvider></AuthProvider>
  </MemoryRouter>);

beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
afterEach(cleanup);

describe('Page d’arrivée de chaque rôle', () => {
  it('envoie le personnel et la plateforme vers leur espace, les autres vers l’accueil', () => {
    expect(homeFor('employee')).toBe('/staff/orders');
    expect(homeFor('manager')).toBe('/staff/orders');
    expect(homeFor('admin')).toBe('/staff/orders');
    expect(homeFor('platform_admin')).toBe('/plateforme');
    expect(homeFor('student')).toBe('/');
    expect(homeFor(undefined)).toBe('/');
  });
});

describe('Accueil', () => {
  it('liste les restaurants pour un étudiant connecté, sans bouton d’inscription, et repère le dernier visité', async () => {
    localStorage.setItem('mmm_restaurant', 'chez-lea');
    asRole('student');
    routes('/');
    expect(await screen.findByText('Chez Léa')).toBeInTheDocument();
    expect(screen.getByText('ZeDuc@Space')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Créer un compte étudiant' })).toBeNull();
    expect(screen.getAllByText('Dernier visité')).toHaveLength(1);
  });

  it('garde le bouton d’inscription pour les visiteurs', async () => {
    asRole(null);
    routes('/');
    expect(await screen.findByRole('link', { name: 'Créer un compte étudiant' })).toBeInTheDocument();
    expect(screen.queryByText('Dernier visité')).toBeNull();
  });

  it.each([['employee', 'Tableau de bord du personnel'], ['admin', 'Tableau de bord du personnel'], ['platform_admin', 'Espace plateforme']])(
    'envoie %s directement vers son espace', async (role, text) => {
      asRole(role);
      routes('/');
      expect(await screen.findByText(text)).toBeInTheDocument();
    });

  it('mène au menu après le choix d’un restaurant', async () => {
    asRole('student');
    routes('/');
    await userEvent.click(await screen.findByTestId('select-restaurant-zeduc-space'));
    expect(await screen.findByText('Page du menu')).toBeInTheDocument();
    expect(localStorage.getItem('mmm_restaurant')).toBe('zeduc-space');
  });
});

describe('Connexion', () => {
  async function connect(role: string, from?: string) {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 't' } as never);
    asRole(role, false); // pas encore connecté : le jeton n'est posé qu'au moment de la connexion
    render(
      <MemoryRouter initialEntries={[from ? { pathname: '/login', state: { from: { pathname: from } } } : '/login']}>
        <AuthProvider><RestaurantProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<p>Accueil étudiant</p>} />
            <Route path="/orders" element={<p>Mes commandes</p>} />
            <Route path="/staff/orders" element={<p>Tableau de bord du personnel</p>} />
            <Route path="/plateforme" element={<p>Espace plateforme</p>} />
          </Routes>
        </RestaurantProvider></AuthProvider>
      </MemoryRouter>);
    await userEvent.type(screen.getByLabelText('Adresse e-mail ou téléphone'), 'alex@example.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'Motdepasse1');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
  }

  it('amène le personnel à son tableau de bord', async () => {
    await connect('manager');
    expect(await screen.findByText('Tableau de bord du personnel')).toBeInTheDocument();
  });
  it('amène la plateforme à son espace', async () => {
    await connect('platform_admin');
    expect(await screen.findByText('Espace plateforme')).toBeInTheDocument();
  });
  it('amène un étudiant à l’accueil', async () => {
    await connect('student');
    expect(await screen.findByText('Accueil étudiant')).toBeInTheDocument();
  });
  it('ramène à la page demandée avant la connexion', async () => {
    await connect('student', '/orders');
    expect(await screen.findByText('Mes commandes')).toBeInTheDocument();
  });
});

describe('Pages réservées aux visiteurs', () => {
  it.each([['/login', 'student', '/'], ['/register', 'student', '/'], ['/login', 'employee', '/staff/orders'], ['/register', 'platform_admin', '/plateforme']])(
    'renvoie un utilisateur déjà connecté de %s (%s) vers %s', async (path, role, landing) => {
      asRole(role);
      render(
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider><RestaurantProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<p>Accueil</p>} />
              <Route path="/staff/orders" element={<p>Tableau de bord du personnel</p>} />
              <Route path="/plateforme" element={<p>Espace plateforme</p>} />
            </Routes>
          </RestaurantProvider></AuthProvider>
        </MemoryRouter>);
      const expected = { '/': 'Accueil', '/staff/orders': 'Tableau de bord du personnel', '/plateforme': 'Espace plateforme' }[landing];
      expect(await screen.findByText(expected!)).toBeInTheDocument();
    });
});

describe('Numéros de téléphone', () => {
  it.each([
    ['0990001111', '+243990001111'], ['990001111', '+243990001111'], ['243990001111', '+243990001111'],
    ['00243990001111', '+243990001111'], ['+243 99 000 11 11', '+243990001111'], ['+243990001111', '+243990001111'],
  ])('normalise %s en %s', (saisi, attendu) => { expect(normalizePhone(saisi)).toBe(attendu); });

  it('l’inscription accepte un numéro écrit avec le zéro initial', async () => {
    asRole(null);
    const register = vi.spyOn(registrationApi, 'register').mockResolvedValue({ token: 't' } as never);
    routes('/register');
    await userEvent.type(await screen.findByLabelText('Nom complet'), 'Aline Mbuyi');
    await userEvent.type(screen.getByLabelText('Adresse e-mail'), 'aline@example.test');
    await userEvent.type(screen.getByLabelText('Numéro de téléphone'), '0990001111');
    await userEvent.type(screen.getByLabelText('Mot de passe', { selector: '#register-password' }), 'Motdepasse1');
    await userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'Motdepasse1');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }));
    await waitFor(() => expect(register).toHaveBeenCalledWith(expect.objectContaining({ phone: '+243990001111' })));
  });
});

describe('Inscription : liens légaux', () => {
  it('pointent vers les vraies pages juridiques', async () => {
    asRole(null);
    routes('/register');
    const conditions = await screen.findByRole('link', { name: /conditions d'utilisation/ });
    expect(conditions).toHaveAttribute('href', '/legal/conditions');
    expect(screen.getByRole('link', { name: /politique de confidentialité/ })).toHaveAttribute('href', '/legal/confidentialite');
    await userEvent.click(conditions);
    await waitFor(() => expect(screen.getByText('Conditions d’utilisation')).toBeInTheDocument());
  });
});

describe('Barre de navigation étudiante', () => {
  const mount = (cartCount?: number) => render(
    <MemoryRouter><LayoutView role="student" scopeSlug="zeduc-space" onLogout={vi.fn()} cartCount={cartCount}><h1>Contenu</h1></LayoutView></MemoryRouter>);
  const nav = () => screen.getByRole('navigation', { name: 'Navigation principale' });

  it('permet de changer de restaurant', () => {
    mount();
    expect(within(nav()).getByRole('link', { name: 'Changer de restaurant', hidden: true })).toHaveAttribute('href', '/');
  });
  it('affiche le nombre d’articles sur le panier', () => {
    mount(3);
    expect(within(nav()).getByRole('link', { name: /Panier/, hidden: true })).toHaveTextContent('Panier3');
    expect(within(nav()).getByLabelText('3 articles', { selector: 'span' })).toBeInTheDocument();
  });
  it('garde le panier visible dans l’en-tête, même quand le menu est replié sur mobile', () => {
    mount(2);
    const shortcut = screen.getByRole('link', { name: 'Voir le panier, 2 articles', hidden: true });
    expect(shortcut).toHaveAttribute('href', '/r/zeduc-space/cart');
    expect(nav()).not.toContainElement(shortcut);
  });
  it('n’affiche aucun raccourci ni compteur quand le panier est vide', () => {
    mount(0);
    expect(screen.queryByRole('link', { name: /Voir le panier/, hidden: true })).toBeNull();
  });
  it('n’affiche aucun compteur quand le panier est vide', () => {
    mount(0);
    expect(within(nav()).getByRole('link', { name: 'Panier', hidden: true })).toHaveTextContent(/^Panier$/);
  });
});

const brandProfile = { slug: 'zeduc-space', name: 'ZeDuc@Space', logoUrl: '/api/restaurants/zeduc-space/assets/ast_1', colors: { primary: '#2e7d32', secondary: '#14301a' }, fontFamily: 'Georgia', defaultMode: 'dark' };

function mountLayoutAt(path: string, role: 'student' | 'admin' | null) {
  if (role) localStorage.setItem('mmm_token', 'fake-token');
  localStorage.setItem('mmm_restaurant', 'zeduc-space');
  vi.spyOn(api, 'get').mockImplementation(async (apiPath: string) => {
    if (apiPath === '/me') return { id: 'u1', name: 'Alex', role, restaurant: role === 'admin' ? { slug: 'zeduc-space', name: 'ZeDuc@Space' } : null } as never;
    if (apiPath === '/restaurants/zeduc-space') return brandProfile as never;
    return { items: [], total: 0, page: 1, pageSize: 20 } as never;
  });
  render(<MemoryRouter initialEntries={[path]}><AuthProvider><RestaurantProvider><CartProvider><Routes>
    <Route element={<Layout />}><Route path="*" element={<p>Contenu</p>} /></Route>
  </Routes></CartProvider></RestaurantProvider></AuthProvider></MemoryRouter>);
  return () => document.querySelector('.app-shell') as HTMLElement;
}

describe('Charte graphique : plateforme fixe, restaurant propre à chaque restaurant', () => {
  it('applique la charte et le logo du restaurant à ses écrans, pour son personnel même sans restaurant choisi', async () => {
    const shell = mountLayoutAt('/staff/orders', 'admin');
    expect(await screen.findByRole('img', { name: 'ZeDuc@Space' })).toBeInTheDocument();
    expect(shell()).toHaveAttribute('data-mode', 'dark');
    expect(shell().style.getPropertyValue('--mm-brand')).toBe('#2e7d32');
  });

  it.each(['menu', 'cart', 'orders', 'loyalty', 'community', 'claims'])('applique la charte du restaurant consulté sur /r/zeduc-space/%s', async (page) => {
    const shell = mountLayoutAt(`/r/zeduc-space/${page}`, 'student');
    expect(await screen.findByRole('img', { name: 'ZeDuc@Space' })).toBeInTheDocument();
    expect(shell().style.getPropertyValue('--mm-brand')).toBe('#2e7d32');
  });

  it('ne fait pas suivre le panier d’un restaurant dans un autre', async () => {
    const line = (slug: string) => ({ restaurantSlug: slug, lines: [{ id: 'd1', name: 'Plat', restaurantSlug: slug, unitPriceFc: 500, quantity: 2 }] });
    localStorage.setItem('mmm_carts', JSON.stringify({ 'chez-lea': line('chez-lea') }));
    mountLayoutAt('/r/zeduc-space/menu', 'student');
    await screen.findByRole('img', { name: 'ZeDuc@Space' });
    expect(screen.queryByRole('link', { name: /Voir le panier/, hidden: true })).toBeNull();
    cleanup();
    mountLayoutAt('/r/chez-lea/menu', 'student');
    expect(await screen.findByRole('link', { name: 'Voir le panier, 2 articles', hidden: true })).toHaveAttribute('href', '/r/chez-lea/cart');
  });

  it('ne montre à un client hors restaurant que Restaurants, Mes commandes et Mon profil', async () => {
    mountLayoutAt('/', 'student');
    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' });
    await waitFor(() => expect(within(nav).getAllByRole('link', { hidden: true }).map(link => link.textContent)).toEqual(['Restaurants', 'Mes commandes', 'Mon profil']));
  });

  it.each(['/', '/login', '/register', '/forgot-password', '/profile', '/orders', '/legal/mentions', '/legal/conditions'])(
    'garde la charte de la plateforme, fixe, sur %s même avec un restaurant choisi', async (path) => {
      const shell = mountLayoutAt(path, 'student');
      const home = await screen.findByRole('link', { name: /Mon Miam Miam/ });
      expect(home).toBeInTheDocument();
      await waitFor(() => expect(api.get).toHaveBeenCalled());
      expect(screen.queryByRole('img', { name: 'ZeDuc@Space' })).toBeNull();
      expect(shell()).not.toHaveAttribute('data-mode', 'dark');
      expect(shell().style.getPropertyValue('--mm-brand')).toBe('');
      expect(shell().style.getPropertyValue('--mm-font-family')).toBe('');
    });

  it('garde aussi la charte de la plateforme pour un visiteur et pour son administrateur', () => {
    const { unmount } = render(<MemoryRouter><LayoutView role={undefined} platformStyle restaurant={brandProfile as never} onLogout={vi.fn()}><h1>Contenu</h1></LayoutView></MemoryRouter>);
    expect(screen.getByRole('banner')).toHaveTextContent('Mon Miam Miam');
    expect(screen.getByRole('banner')).not.toHaveTextContent('ZeDuc@Space');
    expect((document.querySelector('.app-shell') as HTMLElement).style.getPropertyValue('--mm-brand')).toBe('');
    unmount();
  });
});

describe('Logos des restaurants', () => {
  const withLogo = { slug: 'chez-lea', name: 'Chez Léa', slogan: null, logoUrl: '/api/restaurants/chez-lea/assets/ast_1', colors: { primary: '#c4552d', secondary: '#3b1f14' }, isOpenNow: true };
  const withoutLogo = { slug: 'nouveau', name: 'Nouveau Resto', slogan: null, logoUrl: null, colors: { primary: '#1f6f43', secondary: '#ffffff' }, isOpenNow: true };

  it('affiche le logo de chaque restaurant sur l’accueil, ou une pastille avec son initiale à défaut', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ items: [withLogo, withoutLogo], total: 2, page: 1, pageSize: 20 } as never);
    routes('/');
    const logoCard = (await screen.findByRole('heading', { name: 'Chez Léa' })).closest('section') as HTMLElement;
    expect(logoCard.querySelector('img.restaurant-logo')).toHaveAttribute('src', '/api/restaurants/chez-lea/assets/ast_1');
    const plainCard = screen.getByRole('heading', { name: 'Nouveau Resto' }).closest('section') as HTMLElement;
    expect(plainCard.querySelector('img')).toBeNull();
    expect(plainCard.querySelector('.restaurant-monogram')).toHaveTextContent('N');
    expect((plainCard.querySelector('.restaurant-monogram') as HTMLElement).style.background).toContain('rgb(31, 111, 67)');
  });

  it('garde le nom de chaque restaurant écrit à côté de son logo (accessibilité)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ items: [withLogo], total: 1, page: 1, pageSize: 20 } as never);
    routes('/');
    expect(await screen.findByRole('heading', { name: 'Chez Léa' })).toBeInTheDocument();
  });
});
