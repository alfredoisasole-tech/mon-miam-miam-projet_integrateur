import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { register, login, setRestaurant, restaurantState } = vi.hoisted(() => ({
  register: vi.fn(), login: vi.fn(), setRestaurant: vi.fn(), restaurantState: { slug: null as string | null },
}));

vi.mock('../controllers/session', () => ({
  useAuth: () => ({ login }),
  useRestaurant: () => ({ slug: restaurantState.slug, setRestaurant }),
}));
vi.mock('../models/authApi', () => ({ authApi: { register } }));
vi.mock('../controllers/restaurants', () => ({
  useRestaurants: () => ({
    restaurants: [
      { slug: 'chez-lea', name: 'Chez Léa', slogan: null, logoUrl: null, colors: { primary: '#cfbd97', secondary: '#000000' }, isOpenNow: true },
      { slug: 'zeduc-space', name: 'ZeDuc@Space', slogan: null, logoUrl: null, colors: { primary: '#cfbd97', secondary: '#000000' }, isOpenNow: true },
    ],
    isLoading: false, error: null, reload: vi.fn(),
  }),
}));

import { RegisterPage } from '../views/pages/RegisterPage';

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(document.querySelector('input[name="name"]')!, 'Alfredo Isasole');
  await user.type(document.querySelector('input[name="email"]')!, 'alfredo@example.com');
  await user.type(document.querySelector('input[name="phone"]')!, '+243991429583');
  await user.type(document.querySelector('input[name="password"]')!, 'Motdepasse1');
  await user.type(document.querySelector('input[name="confirmPassword"]')!, 'Motdepasse1');
  await user.click(screen.getByRole('checkbox'));
}

beforeEach(() => {
  vi.clearAllMocks();
  restaurantState.slug = null;
  register.mockResolvedValue({ token: 't' });
});
afterEach(cleanup);

describe('Inscription : choix du restaurant', () => {
  it('propose la liste des restaurants quand aucun n’a été choisi', () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    const select = screen.getByLabelText('Restaurant');
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Chez Léa' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ZeDuc@Space' })).toBeInTheDocument();
  });

  it('crée le compte dans le restaurant choisi puis le mémorise', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    await user.selectOptions(screen.getByLabelText('Restaurant'), 'zeduc-space');
    await fill(user);
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }));
    await waitFor(() => expect(register).toHaveBeenCalledWith('zeduc-space', expect.objectContaining({ email: 'alfredo@example.com' })));
    expect(setRestaurant).toHaveBeenCalledWith('zeduc-space');
    expect(login).toHaveBeenCalledWith('t');
  });

  it('demande de choisir un restaurant au lieu d’un message de retour à l’accueil', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /créer mon compte/i }));
    expect(await screen.findByText('Choisissez le restaurant où créer votre compte.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('préselectionne le restaurant déjà mémorisé par le site', () => {
    restaurantState.slug = 'chez-lea';
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    expect(screen.getByLabelText('Restaurant')).toHaveValue('chez-lea');
  });
});
