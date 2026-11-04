import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { register, login } = vi.hoisted(() => ({ register: vi.fn(), login: vi.fn() }));

vi.mock('../controllers/session', () => ({ useAuth: () => ({ login }) }));
vi.mock('../models/authApi', () => ({ authApi: { register } }));

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
  register.mockResolvedValue({ token: 't' });
});
afterEach(cleanup);

describe('Inscription : un compte de la plateforme, sans restaurant', () => {
  it('ne demande pas de restaurant et explique que le compte vaut partout', () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    expect(screen.queryByLabelText('Restaurant')).toBeNull();
    expect(screen.getByText(/Un seul compte pour tous les restaurants/)).toBeInTheDocument();
  });

  it('inscrit le compte sans désigner aucun restaurant, même quand aucun n’a été consulté', async () => {
    await fillAndSubmit();
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ email: 'alfredo@example.com' }));
    expect(login).toHaveBeenCalledWith('t');
  });
});
