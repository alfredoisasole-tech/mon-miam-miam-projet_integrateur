import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App.tsx';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
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
    ['/menu', 'Choisissez un restaurant pour afficher son menu.'],
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
});
