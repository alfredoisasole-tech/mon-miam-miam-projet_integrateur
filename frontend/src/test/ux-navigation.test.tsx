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
import { LayoutView } from '../views/components/Layout.tsx';
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
        <Route path="/menu" element={<p>Page du menu</p>} />
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
  it('liste les restaurants pour un étudiant connecté, sans bouton d’inscription, et repère le sien', async () => {
    localStorage.setItem('mmm_restaurant', 'chez-lea');
    asRole('student');
    routes('/');
    expect(await screen.findByText('Chez Léa')).toBeInTheDocument();
    expect(screen.getByText('ZeDuc@Space')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Créer un compte étudiant' })).toBeNull();
    expect(screen.getAllByText('Votre restaurant')).toHaveLength(1);
  });

  it('garde le bouton d’inscription pour les visiteurs', async () => {
    asRole(null);
    routes('/');
    expect(await screen.findByRole('link', { name: 'Créer un compte étudiant' })).toBeInTheDocument();
    expect(screen.queryByText('Votre restaurant')).toBeNull();
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
    await waitFor(() => expect(register).toHaveBeenCalledWith('chez-lea', expect.objectContaining({ phone: '+243990001111' })));
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
    <MemoryRouter><LayoutView role="student" onLogout={vi.fn()} cartCount={cartCount}><h1>Contenu</h1></LayoutView></MemoryRouter>);
  const nav = () => screen.getByRole('navigation', { name: 'Navigation principale' });

  it('permet de changer de restaurant', () => {
    mount();
    expect(within(nav()).getByRole('link', { name: 'Restaurants', hidden: true })).toHaveAttribute('href', '/');
  });
  it('affiche le nombre d’articles sur le panier', () => {
    mount(3);
    expect(within(nav()).getByRole('link', { name: /Panier/, hidden: true })).toHaveTextContent('Panier3');
    expect(within(nav()).getByLabelText('3 articles', { selector: 'span' })).toBeInTheDocument();
  });
  it('garde le panier visible dans l’en-tête, même quand le menu est replié sur mobile', () => {
    mount(2);
    const shortcut = screen.getByRole('link', { name: 'Voir le panier, 2 articles', hidden: true });
    expect(shortcut).toHaveAttribute('href', '/cart');
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
