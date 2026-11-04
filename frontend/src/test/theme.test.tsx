import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LayoutView } from '../views/components/Layout.tsx';
import type { RestaurantBrand } from '../controllers/useRestaurantProfile.ts';

afterEach(cleanup);
const base: RestaurantBrand = { slug: 'campus', name: 'Table du campus', colors: { primary: '#cfbd97', secondary: '#000000' } };
function mount(restaurant: RestaurantBrand, role: 'platform_admin' | undefined = undefined) {
  return render(<MemoryRouter><LayoutView role={role} restaurant={restaurant} onLogout={vi.fn()}><h1>Contenu</h1></LayoutView></MemoryRouter>);
}
const shell = () => screen.getByRole('banner').parentElement as HTMLElement;

describe('Thème propre à chaque restaurant', () => {
  it('applique la police choisie par le restaurant', () => {
    mount({ ...base, fontFamily: 'Georgia' });
    expect(shell().style.getPropertyValue('--mm-font-family')).toContain('Georgia');
  });
  it('ignore une police hors liste', () => {
    mount({ ...base, fontFamily: 'x; background: url(evil)' });
    expect(shell().style.getPropertyValue('--mm-font-family')).toBe('');
  });
  it('expose le mode par défaut et laisse le clair par défaut', () => {
    mount({ ...base, defaultMode: 'dark' });
    expect(shell()).toHaveAttribute('data-mode', 'dark');
    cleanup();
    mount(base);
    expect(shell()).toHaveAttribute('data-mode', 'light');
  });
  it('affiche le logo du restaurant avec son nom en texte alternatif', () => {
    mount({ ...base, logoUrl: '/api/restaurants/campus/assets/ast_1' });
    const logo = screen.getByRole('img', { name: 'Table du campus' });
    expect(logo).toHaveAttribute('src', expect.stringContaining('/api/restaurants/campus/assets/ast_1'));
  });
  it('sans logo, affiche seulement le nom', () => {
    mount(base);
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('la plateforme n’hérite ni du logo ni du mode du restaurant', () => {
    mount({ ...base, logoUrl: '/x', defaultMode: 'dark' }, 'platform_admin');
    expect(screen.queryByRole('img')).toBeNull();
    expect(shell()).not.toHaveAttribute('data-mode', 'dark');
  });
});
