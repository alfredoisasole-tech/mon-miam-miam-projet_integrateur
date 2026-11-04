import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { register, login, setRestaurant, state } = vi.hoisted(() => ({
  register: vi.fn(), login: vi.fn(), setRestaurant: vi.fn(),
  state: { slug: null as string | null, restaurants: [] as Array<{ slug: string; name: string }> },
}));

vi.mock('../controllers/session', () => ({
  useAuth: () => ({ login }),
  useRestaurant: () => ({ slug: state.slug, setRestaurant }),
}));
vi.mock('../models/authApi', () => ({ authApi: { register } }));
vi.mock('../controllers/restaurants', () => ({
  useRestaurants: () => ({ restaurants: state.restaurants, isLoading: false, error: null, reload: vi.fn() }),
}));

import { RegisterPage } from '../views/pages/RegisterPage';

async function fillAndSubmit() {
  const user = userEvent.setup();
  render(<MemoryRouter><RegisterPage /></MemoryRouter>);
  await user.type(document.querySelector('input[name="name"]')!, 'Alfredo Isasole');
  await user.type(document.querySelector('input[name="email"]')!, 'alfredo@example.com');
  await user.type(document.querySelector('input[name="phone"]')!, '+243991429583');
  await user.type(document.querySelector('input[name="password"]')!, 'Motdepasse1');
  await user.type(document.querySelector('input[name="confirmPassword"]')!, 'Motdepasse1');
  await user.click(screen.getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: /créer mon compte/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  state.slug = null;
  state.restaurants = [{ slug: 'chez-lea', name: 'Chez Léa' }, { slug: 'zeduc-space', name: 'ZeDuc@Space' }];
  register.mockResolvedValue({ token: 't' });
});
afterEach(cleanup);

describe('Inscription : un seul compte pour tous les restaurants', () => {
  it('ne demande pas de restaurant et explique que le compte vaut partout', () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    expect(screen.queryByLabelText('Restaurant')).toBeNull();
    expect(screen.getByText(/Un seul compte pour tous les restaurants/)).toBeInTheDocument();
  });

  it('inscrit auprès du premier restaurant quand aucun n’a été consulté', async () => {
    await fillAndSubmit();
    await waitFor(() => expect(register).toHaveBeenCalledWith('chez-lea', expect.objectContaining({ email: 'alfredo@example.com' })));
    expect(login).toHaveBeenCalledWith('t');
  });

  it('inscrit auprès du restaurant que le visiteur consultait', async () => {
    state.slug = 'zeduc-space';
    await fillAndSubmit();
    await waitFor(() => expect(register).toHaveBeenCalledWith('zeduc-space', expect.anything()));
  });

  it('explique le problème quand aucun restaurant n’est disponible', async () => {
    state.restaurants = [];
    await fillAndSubmit();
    expect(await screen.findByText(/Aucun restaurant n’est disponible/)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
});
