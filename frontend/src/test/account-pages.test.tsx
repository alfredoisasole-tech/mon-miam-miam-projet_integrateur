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
  accountApi: { forgotPassword: vi.fn(), resetPassword: vi.fn(), changePassword: vi.fn(), updateProfile: vi.fn(), exportData: vi.fn(), deleteAccount: vi.fn() },
}));
vi.mock('../controllers/session.tsx', () => ({ useAuth: vi.fn() }));
const api = vi.mocked(accountApi);
const login = vi.fn();
const logout = vi.fn();
const updateUser = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(session.useAuth).mockReturnValue({ user: { id: 'u1', name: 'Alice', role: 'student' }, loading: false, login, logout, updateUser });
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
    vi.mocked(session.useAuth).mockReturnValue({ user: { id: 'u2', name: 'Chef', role: 'employee', mustChangePassword: true }, loading: false, login, logout, updateUser });
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.getByText(/mot de passe est temporaire/i)).toBeInTheDocument();
  });
  it('masque la suppression pour le personnel', () => {
    vi.mocked(session.useAuth).mockReturnValue({ user: { id: 'u2', name: 'Chef', role: 'manager' }, loading: false, login, logout, updateUser });
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Supprimer mon compte' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Télécharger mes données' })).toBeNull();
  });
});

describe('Mes informations (profil)', () => {
  const student = { id: 'u1', name: 'Alice', role: 'student' as const, email: 'alice@exemple.com', phone: '+243810000010', commune: 'Gombe', quartier: null, address: '3 rue des Écoles' };
  const asUser = (user: object) => vi.mocked(session.useAuth).mockReturnValue({ user, loading: false, login, logout, updateUser } as never);
  const form = () => screen.getByRole('form', { name: 'Mes informations' });
  const open = () => render(<MemoryRouter><ProfilePage /></MemoryRouter>);

  it('affiche les informations actuelles et rappelle que l’e-mail ne se modifie pas', () => {
    asUser(student);
    open();
    expect(screen.getByLabelText('Nom', { selector: 'form[aria-label="Mes informations"] input' })).toHaveValue('Alice');
    expect(screen.getByLabelText('Téléphone')).toHaveValue('+243810000010');
    expect(screen.getByLabelText('Commune')).toHaveValue('Gombe');
    expect(screen.getByLabelText('Adresse')).toHaveValue('3 rue des Écoles');
    expect(form()).toHaveTextContent('alice@exemple.com');
    expect(screen.queryByLabelText('Mot de passe actuel', { selector: 'form[aria-label="Mes informations"] input' })).toBeNull();
  });

  it('n’envoie que ce qui a changé et met à jour la session', async () => {
    asUser(student);
    api.updateProfile.mockResolvedValue({ ...student, name: 'Alice Martin', address: '10 avenue du Marché' } as never);
    open();
    const name = screen.getByLabelText('Nom', { selector: 'form[aria-label="Mes informations"] input' });
    await userEvent.clear(name); await userEvent.type(name, 'Alice Martin');
    const address = screen.getByLabelText('Adresse');
    await userEvent.clear(address); await userEvent.type(address, '10 avenue du Marché');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ name: 'Alice Martin', address: '10 avenue du Marché' }));
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alice Martin' }));
    expect(await screen.findByText('Vos informations sont enregistrées.')).toBeInTheDocument();
  });

  it('demande le mot de passe actuel pour changer de numéro et accepte l’écriture avec le zéro initial', async () => {
    asUser(student);
    api.updateProfile.mockResolvedValue({ ...student, phone: '+243990001111' } as never);
    open();
    const phone = screen.getByLabelText('Téléphone');
    await userEvent.clear(phone); await userEvent.type(phone, '0990001111');
    const password = await screen.findByLabelText('Mot de passe actuel', { selector: 'form[aria-label="Mes informations"] input' });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }));
    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(await screen.findByText('Indiquez votre mot de passe actuel pour changer de numéro.')).toBeInTheDocument();
    await userEvent.type(password, 'MotActuel1');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ phone: '+243990001111', currentPassword: 'MotActuel1' }));
  });

  it('refuse un numéro invalide sans appeler le serveur', async () => {
    asUser(student);
    open();
    const phone = screen.getByLabelText('Téléphone');
    await userEvent.clear(phone); await userEvent.type(phone, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }));
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('efface la commune et l’adresse avec null', async () => {
    asUser(student);
    api.updateProfile.mockResolvedValue({ ...student, commune: null, address: null } as never);
    open();
    await userEvent.selectOptions(screen.getByLabelText('Commune'), '');
    await userEvent.clear(screen.getByLabelText('Adresse'));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ commune: null, address: null }));
  });

  it('affiche l’erreur du serveur, par exemple un numéro déjà utilisé', async () => {
    asUser(student);
    api.updateProfile.mockRejectedValue(new ApiError(409, 'PHONE_TAKEN', 'Un compte existe déjà avec ce téléphone.'));
    open();
    const phone = screen.getByLabelText('Téléphone');
    await userEvent.clear(phone); await userEvent.type(phone, '+243820000002');
    await userEvent.type(await screen.findByLabelText('Mot de passe actuel', { selector: 'form[aria-label="Mes informations"] input' }), 'MotActuel1');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }));
    expect(await screen.findByText('Un compte existe déjà avec ce téléphone.')).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('n’envoie rien quand rien n’a changé', async () => {
    asUser(student);
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer mes informations' }));
    expect(api.updateProfile).not.toHaveBeenCalled();
    expect(await screen.findByText('Aucun changement à enregistrer.')).toBeInTheDocument();
  });

  it('ne propose pas d’adresse de livraison au personnel', () => {
    asUser({ id: 's1', name: 'Chef', role: 'employee', email: 'chef@exemple.com', phone: '+243810000011' });
    open();
    expect(screen.getByLabelText('Téléphone')).toHaveValue('+243810000011');
    expect(screen.queryByLabelText('Commune')).toBeNull();
    expect(screen.queryByLabelText('Adresse')).toBeNull();
  });
});
