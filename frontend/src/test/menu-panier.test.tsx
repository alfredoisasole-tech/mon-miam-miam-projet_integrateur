import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, RestaurantProvider } from '../controllers/session.tsx';
import { CartProvider } from '../controllers/cart.tsx';
import { MenuPage } from '../views/pages/MenuPage.tsx';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../models/http.ts', () => ({ api: { get }, assetUrl: (path: string) => path }));

const menu = {
  restaurant: 'alpha',
  dailyItems: [],
  categories: [{ name: 'Plats', items: [
    { id: 'd1', name: 'Poulet braisé', description: null, priceFc: 500, isDaily: false, isAvailable: true, imageUrl: null },
    { id: 'd2', name: 'Riz cantonais', description: null, priceFc: 1000, isDaily: false, isAvailable: true, imageUrl: null },
  ] }],
};

function mount(role: 'student' | null = 'student') {
  if (role) localStorage.setItem('mmm_token', 'fake-token');
  get.mockImplementation(async (path: string) => {
    if (path === '/me') return { id: 'u1', name: 'Alex', email: 'alex@example.com', role };
    if (path.endsWith('/promotions')) return [];
    return menu;
  });
  render(<MemoryRouter><AuthProvider><RestaurantProvider><CartProvider><MenuPage /></CartProvider></RestaurantProvider></AuthProvider></MemoryRouter>);
}
const addButtons = () => screen.findAllByTestId('add-button');

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); localStorage.setItem('mmm_restaurant', 'alpha'); });
afterEach(cleanup);

describe('Menu : ce qui est déjà dans le panier', () => {
  it('n’affiche aucun résumé tant que le panier est vide', async () => {
    mount();
    await addButtons();
    expect(screen.queryByRole('complementary', { name: 'Résumé du panier' })).toBeNull();
    expect(screen.queryByTestId('in-cart-badge')).toBeNull();
  });

  it('affiche le nombre d’articles et le total après chaque ajout', async () => {
    mount();
    const buttons = await addButtons();
    await userEvent.click(buttons[0]!);
    const summary = await screen.findByRole('complementary', { name: 'Résumé du panier' });
    expect(summary).toHaveTextContent('1 article');
    expect(summary).toHaveTextContent('500 FC');
    await userEvent.click(buttons[0]!);
    await userEvent.click(buttons[1]!);
    expect(summary).toHaveTextContent('3 articles');
    expect(summary).toHaveTextContent('2 000 FC');
  });

  it('détaille chaque plat pris avec sa quantité et son sous-total', async () => {
    mount();
    const buttons = await addButtons();
    await userEvent.click(buttons[0]!);
    await userEvent.click(buttons[0]!);
    await userEvent.click(buttons[1]!);
    const summary = await screen.findByRole('complementary', { name: 'Résumé du panier' });
    expect(within(summary).getByText(/2 × Poulet braisé/)).toHaveTextContent('1 000 FC');
    expect(within(summary).getByText(/1 × Riz cantonais/)).toHaveTextContent('1 000 FC');
  });

  it('indique sur chaque plat la quantité déjà prise', async () => {
    mount();
    const buttons = await addButtons();
    await userEvent.click(buttons[0]!);
    await userEvent.click(buttons[0]!);
    expect(await screen.findByText('2 dans le panier')).toBeInTheDocument();
    expect(within(screen.getByTestId('dish-d2')).queryByTestId('in-cart-badge')).toBeNull();
  });

  it('renvoie vers le panier', async () => {
    mount();
    await userEvent.click((await addButtons())[0]!);
    expect(await screen.findByRole('link', { name: 'Voir le panier' })).toHaveAttribute('href', '/cart');
  });

  it('n’affiche rien aux visiteurs qui ne sont pas étudiants', async () => {
    mount(null);
    await screen.findByText('Poulet braisé');
    expect(screen.queryByRole('complementary', { name: 'Résumé du panier' })).toBeNull();
  });
});
