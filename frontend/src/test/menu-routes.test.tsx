import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../App';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

it.each([
  ['/staff/menu', 'employee', 'Gestion rapide du menu (Staff)'],
  ['/staff/menu', 'manager', 'Gestion rapide du menu (Staff)'],
  ['/staff/menu', 'admin', 'Gestion rapide du menu (Staff)'],
  ['/admin/menu', 'admin', 'Administration du Menu'],
])('ouvre %s pour %s et charge le menu avec un seul préfixe API', async (path, role, title) => {
  localStorage.setItem('mmm_token', 'menu-route-test');
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/me') return Response.json({ id: 'staff', name: 'Démo', role });
    if (url === '/api/staff/menu') return Response.json([
      { id: 'pondu', name: 'Pondu', priceFc: 2500, description: null, isDaily: true, isAvailable: true, imageUrl: null },
    ]);
    throw new Error(`Adresse inattendue : ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', path);
  render(<App />);
  expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  expect(await screen.findByText(/^Pondu(?: - 2500 FC)?$/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/staff/menu', expect.objectContaining({ method: 'GET' }));
  expect(window.location.pathname).toBe(path);
});

it.each([
  ['/staff/menu', 'student'], ['/staff/menu', 'platform_admin'],
  ['/admin/menu', 'employee'], ['/admin/menu', 'manager'],
  ['/admin/menu', 'student'], ['/admin/menu', 'platform_admin'],
])('refuse %s à %s avant tout chargement du menu', async (path, role) => {
  localStorage.setItem('mmm_token', 'menu-route-test');
  const fetchMock = vi.fn(async () => Response.json({ id: 'user', name: 'Démo', role }));
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', path);
  render(<App />);
  // Un utilisateur refusé revient à sa page d'arrivée : l'accueil pour un étudiant, son tableau de bord pour le personnel.
  const landing = { student: '/', employee: '/staff/orders', manager: '/staff/orders', platform_admin: '/plateforme' }[role];
  await waitFor(() => expect(window.location.pathname).toBe(landing));
  const urls = (fetchMock.mock.calls as unknown as Array<[unknown]>).map(([url]) => String(url));
  expect(urls.some(url => url.endsWith('/menu') || url.includes('/staff/menu'))).toBe(false);
});

it.each(['/staff/menu', '/admin/menu'])('demande une connexion pour %s sans appeler le menu', async (path) => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', path);
  render(<App />);
  expect(await screen.findByLabelText('Adresse e-mail ou téléphone')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/login');
  expect(fetchMock).not.toHaveBeenCalled();
});
