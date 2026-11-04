import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LayoutView } from '../views/components/Layout.tsx';
import type { User } from '../models/types.ts';

afterEach(cleanup);
const cases: [User['role'], string[]][] = [
  [undefined, ['Accueil', 'Connexion', 'Inscription']],
  ['student', ['Menu', 'Panier', 'Mes commandes', 'Mes points']],
  ['employee', ['Commandes', 'Menu', 'Statistiques']],
  ['manager', ['Commandes', 'Menu', 'Statistiques']],
  ['admin', ['Commandes', 'Menu', 'Statistiques', 'Paramètres']],
  ['platform_admin', ['Restaurants']],
];
function mount(role?: User['role'], extra = {}) {
  return render(<MemoryRouter initialEntries={['/menu']}><LayoutView role={role} onLogout={vi.fn()} {...extra}><h1>Contenu</h1></LayoutView></MemoryRouter>);
}
describe('Mise en page E-6', () => {
  it.each(cases)('expose uniquement les liens du rôle %s', (role, labels) => {
    mount(role);
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getAllByRole('link', { hidden: true }).map(link => link.textContent)).toEqual(labels);
    expect(screen.queryByRole('button', { name: 'Déconnexion' })).toBe(role ? screen.getByRole('button', { name: 'Déconnexion' }) : null);
  });
  it('affiche le restaurant, ses couleurs, un contenu principal et un pied de page', () => {
    mount('student', { restaurant: { slug: 'campus', name: 'Table du campus', colors: { primary: '#cfbd97', secondary: '#000000' } } });
    expect(screen.getByRole('banner')).toHaveTextContent('Table du campus');
    expect(screen.getByRole('main')).toHaveTextContent('Contenu');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Mon Miam Miam');
    expect(screen.getByRole('banner').parentElement?.style.getPropertyValue('--mm-header-bg')).toBe('#000000');
  });
  it('ouvre le menu, le referme avec Échap et rend le focus au bouton', () => {
    mount();
    const button = screen.getByRole('button', { name: 'Ouvrir le menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(screen.getByRole('navigation', { name: 'Navigation principale' }), { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });
  it('referme le menu après navigation et marque la page active', () => {
    render(<MemoryRouter><Routes><Route element={<LayoutView onLogout={vi.fn()} />}><Route path="*" element={<p>Page</p>} /></Route></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Connexion' }));
    expect(screen.getByRole('link', { name: 'Connexion' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Ouvrir le menu' })).toHaveAttribute('aria-expanded', 'false');
  });
  it('déclenche la déconnexion et masque les liens pendant la restauration de session', () => {
    const logout = vi.fn();
    const { rerender } = mount('student', { onLogout: logout });
    fireEvent.click(screen.getByRole('button', { name: 'Déconnexion' }));
    expect(logout).toHaveBeenCalledOnce();
    rerender(<MemoryRouter><LayoutView role="student" loading onLogout={logout} /></MemoryRouter>);
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Chargement');
  });
  it('la plateforme garde son identité et ignore les couleurs du restaurant', () => {
    mount('platform_admin', { restaurant: { slug: 'a', name: 'Autre restaurant', colors: { primary: 'red', secondary: 'url(x)' } } });
    expect(screen.getByRole('banner')).toHaveTextContent('Mon Miam Miam · Plateforme');
    expect(screen.getByRole('banner')).not.toHaveTextContent('Autre restaurant');
    expect(screen.getByRole('banner').parentElement?.style.getPropertyValue('--mm-header-bg')).toBe('');
  });
});
