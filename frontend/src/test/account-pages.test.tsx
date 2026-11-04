import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountApi } from '../controllers/account.ts';
import { ForgotPasswordPage } from '../views/pages/ForgotPasswordPage.tsx';
import { ProfilePage } from '../views/pages/ProfilePage.tsx';
import { ApiError } from '../models/types.ts';
import * as session from '../controllers/session.tsx';

vi.mock('../controllers/account.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../controllers/account.ts')>()),
  accountApi: { forgotPassword: vi.fn(), resetPassword: vi.fn(), changePassword: vi.fn(), exportData: vi.fn(), deleteAccount: vi.fn() },
}));
vi.mock('../controllers/session.tsx', () => ({ useAuth: vi.fn() }));
const api = vi.mocked(accountApi);
const login = vi.fn();
const logout = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(session.useAuth).mockReturnValue({ user: { id: 'u1', name: 'Alice', role: 'student' }, loading: false, login, logout });
});
afterEach(cleanup);

describe('Mot de passe oublié', () => {
  it('demande le code puis choisit un nouveau mot de passe', async () => {
    api.forgotPassword.mockResolvedValue(undefined);
    api.resetPassword.mockResolvedValue(undefined);
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText('Adresse e-mail ou téléphone'), 'alice@exemple.com');
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }));
    await waitFor(() => expect(api.forgotPassword).toHaveBeenCalledWith('alice@exemple.com'));
    await userEvent.type(await screen.findByLabelText('Code reçu'), 'A1B2C3D4');
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'NouveauMot1');
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    await waitFor(() => expect(api.resetPassword).toHaveBeenCalledWith('alice@exemple.com', 'A1B2C3D4', 'NouveauMot1'));
    expect(await screen.findByRole('status')).toHaveTextContent(/mot de passe a été changé/i);
  });
  it('refuse un mot de passe faible sans appeler le serveur', async () => {
    api.forgotPassword.mockResolvedValue(undefined);
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText('Adresse e-mail ou téléphone'), 'alice@exemple.com');
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }));
    await userEvent.type(await screen.findByLabelText('Code reçu'), 'A1B2C3D4');
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'faible');
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveAttribute('aria-invalid', 'true');
    expect(api.resetPassword).not.toHaveBeenCalled();
  });
  it('affiche l’indisponibilité du service d’envoi', async () => {
    api.forgotPassword.mockRejectedValue(new ApiError(503, 'RESET_DELIVERY_UNAVAILABLE', 'Service indisponible.'));
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText('Adresse e-mail ou téléphone'), 'alice@exemple.com');
    await userEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Service indisponible.');
  });
});

describe('Mon profil', () => {
  it('change le mot de passe et garde la session avec le nouveau jeton', async () => {
    api.changePassword.mockResolvedValue({ token: 'tok2' });
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText('Mot de passe actuel'), 'Ancien1234');
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'NouveauMot1');
    await userEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    await waitFor(() => expect(api.changePassword).toHaveBeenCalledWith('Ancien1234', 'NouveauMot1'));
    expect(login).toHaveBeenCalledWith('tok2');
  });
  it('exporte les données personnelles', async () => {
    api.exportData.mockResolvedValue(undefined);
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Télécharger mes données' }));
    await waitFor(() => expect(api.exportData).toHaveBeenCalled());
  });
  it('demande le mot de passe avant de supprimer le compte puis déconnecte', async () => {
    api.deleteAccount.mockResolvedValue(undefined);
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    await userEvent.type(screen.getByLabelText('Mot de passe pour confirmer'), 'Ancien1234');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    await waitFor(() => expect(api.deleteAccount).toHaveBeenCalledWith('Ancien1234'));
    expect(logout).toHaveBeenCalled();
  });
  it('explique pourquoi une commande en cours empêche la suppression', async () => {
    api.deleteAccount.mockRejectedValue(new ApiError(409, 'ORDER_IN_PROGRESS', 'Une commande est en cours.'));
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    await userEvent.type(screen.getByLabelText('Mot de passe pour confirmer'), 'Ancien1234');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer la suppression' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Une commande est en cours.');
    expect(logout).not.toHaveBeenCalled();
  });
  it('explique le changement obligatoire du mot de passe temporaire', () => {
    vi.mocked(session.useAuth).mockReturnValue({ user: { id: 'u2', name: 'Chef', role: 'employee', mustChangePassword: true }, loading: false, login, logout });
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.getByText(/mot de passe est temporaire/i)).toBeInTheDocument();
  });
  it('masque la suppression pour le personnel', () => {
    vi.mocked(session.useAuth).mockReturnValue({ user: { id: 'u2', name: 'Chef', role: 'manager' }, loading: false, login, logout });
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Supprimer mon compte' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Télécharger mes données' })).toBeNull();
  });
});
