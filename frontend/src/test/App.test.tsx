import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App.tsx';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('Page principale', () => {
  it('affiche le titre « Mon Miam Miam »', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Mon Miam Miam' })).toBeTruthy();
  });

  it('contient une zone principale accessible aux lecteurs d\'écran', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeTruthy();
  });

  it.each([
    ['/login', 'Heureux de vous retrouver à table.'],
    ['/register', 'Créez votre compte étudiant'],
    ['/staff/overview', 'Heureux de vous retrouver à table.'],
    ['/menu', 'Vos repas du campus, commandés en quelques clics'],
    ['/adresse-inconnue', 'Page indisponible'],
  ])('affiche la page %s dans la mise en page commune', (path, text) => {
    window.history.replaceState(null, '', path);
    render(<App />);

    expect(screen.getByText(text, { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveAttribute('href', '#main-content');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    expect(screen.getByText(/©.*Mon Miam Miam · Vos repas sur le campus/)).toBeInTheDocument();
  });

  it('relie la navigation et les liens entre connexion et inscription', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    fireEvent.click(within(nav).getByRole('link', { name: 'Connexion', hidden: true }));
    expect(screen.getByLabelText('Adresse e-mail ou téléphone')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Créer un compte' }));
    expect(screen.getByRole('heading', { name: 'Créez votre compte étudiant' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Se connecter' }));
    expect(screen.getByLabelText('Adresse e-mail ou téléphone')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('revient aux statistiques demandées après connexion du gérant', async () => {
    const user = { id: 'manager-test', name: 'Gérante', role: 'manager' };
    const stats = {
      period: 'day', salesFc: 2500, averageOrderFc: 1250,
      orders: { total: 2, completed: 2, active: 0, cancelled: 0 }, topItems: [],
    };
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const payload = input === '/api/auth/login' ? { token: 'route-test-token', user }
        : input === '/api/me' ? user
        : input === '/api/staff/stats/overview?period=day' ? stats : null;
      if (!payload) throw new Error('Requête inattendue dans le parcours de connexion');
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    window.history.replaceState(null, '', '/staff/overview');
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Adresse e-mail ou téléphone'), { target: { value: 'manager@example.test' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'ExampleTest1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('heading', { name: 'Statistiques' })).toBeInTheDocument();
    expect(await screen.findByText('2 500 FC', { exact: false })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/staff/overview');
  });
});
