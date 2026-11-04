import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimsApi } from '../controllers/claims.ts';
import type { StaffClaim, StudentClaim } from '../controllers/claims.ts';
import { ClaimsPage } from '../views/pages/ClaimsPage.tsx';
import { StaffClaimsPage } from '../views/pages/StaffClaimsPage.tsx';
import * as session from '../controllers/session.tsx';

vi.mock('../controllers/claims.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../controllers/claims.ts')>()),
  claimsApi: { create: vi.fn(), list: vi.fn(), staffList: vi.fn(), propose: vi.fn(), validate: vi.fn(), reject: vi.fn() },
}));
vi.mock('../controllers/session.tsx', () => ({ useAuth: vi.fn(), useRestaurant: vi.fn() }));
const api = vi.mocked(claimsApi);

const mine: StudentClaim = {
  id: 'c1', restaurant: { slug: 'zeduc-space', name: 'ZeDuc@Space' }, orderId: null, kind: 'order', subject: 'Plat froid',
  message: 'Mon plat est arrivé froid.', requestedPoints: null, status: 'ouverte', createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z', resolvedAt: null,
};
const staffClaim = (over: Partial<StaffClaim> = {}): StaffClaim => ({
  id: 's1', restaurant: { slug: 'zeduc-space', name: 'ZeDuc@Space' }, student: { id: 'u1', name: 'Alice', phone: '+243810000000' },
  orderId: null, kind: 'order', subject: 'Plat froid', message: 'Mon plat est arrivé froid.', requestedPoints: null,
  status: 'open', proposedDecision: null, proposedResponse: null, proposedBy: null, decision: null, response: null,
  managerNote: null, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z', resolvedAt: null, ...over,
});
function asRole(role: 'student' | 'employee' | 'manager' | 'admin') {
  vi.mocked(session.useAuth).mockReturnValue({ user: { id: 'u', name: 'X', role }, loading: false, login: vi.fn(), logout: vi.fn() });
  vi.mocked(session.useRestaurant).mockReturnValue({ slug: 'zeduc-space', setRestaurant: vi.fn(), clearRestaurant: vi.fn() });
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('Mes réclamations (étudiant)', () => {
  beforeEach(() => { asRole('student'); api.list.mockResolvedValue([mine]); });
  it('liste mes réclamations avec leur état', async () => {
    render(<MemoryRouter><ClaimsPage /></MemoryRouter>);
    expect(await screen.findByText('Plat froid')).toBeInTheDocument();
    expect(screen.getByText('ouverte')).toBeInTheDocument();
  });
  it('dépose une réclamation sur le restaurant courant', async () => {
    api.create.mockResolvedValue({ ...mine, id: 'c2' });
    render(<MemoryRouter><ClaimsPage /></MemoryRouter>);
    await screen.findByText('Plat froid');
    await userEvent.type(screen.getByLabelText('Sujet'), 'Retard');
    await userEvent.type(screen.getByLabelText('Message'), 'La livraison a eu une heure de retard.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la réclamation' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({
      restaurant: 'zeduc-space', kind: 'order', subject: 'Retard', message: 'La livraison a eu une heure de retard.',
    }));
  });
  it('demande le nombre de points pour une réclamation de points', async () => {
    api.create.mockResolvedValue(mine);
    render(<MemoryRouter><ClaimsPage /></MemoryRouter>);
    await screen.findByText('Plat froid');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'points');
    await userEvent.type(screen.getByLabelText('Sujet'), 'Points manquants');
    await userEvent.type(screen.getByLabelText('Message'), 'Il manque des points sur ma dernière commande.');
    await userEvent.type(screen.getByLabelText('Points demandés'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la réclamation' }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ kind: 'points', requestedPoints: 3 })));
  });
  it('refuse un message trop court sans appeler le serveur', async () => {
    render(<MemoryRouter><ClaimsPage /></MemoryRouter>);
    await screen.findByText('Plat froid');
    await userEvent.type(screen.getByLabelText('Sujet'), 'Ok');
    await userEvent.type(screen.getByLabelText('Message'), 'court');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la réclamation' }));
    expect(screen.getByLabelText('Sujet')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Message')).toHaveAttribute('aria-invalid', 'true');
    expect(api.create).not.toHaveBeenCalled();
  });
  it('affiche la limite de cinq réclamations renvoyée par le serveur', async () => {
    api.create.mockRejectedValue(new Error('Vous avez déjà cinq réclamations en cours.'));
    render(<MemoryRouter><ClaimsPage /></MemoryRouter>);
    await screen.findByText('Plat froid');
    await userEvent.type(screen.getByLabelText('Sujet'), 'Retard');
    await userEvent.type(screen.getByLabelText('Message'), 'La livraison a eu une heure de retard.');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la réclamation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('cinq réclamations');
  });
});

describe('Réclamations du restaurant (personnel)', () => {
  it('l’employé propose une décision', async () => {
    asRole('employee');
    api.staffList.mockResolvedValue([staffClaim()]);
    api.propose.mockResolvedValue(staffClaim({ status: 'pending_validation' }));
    render(<MemoryRouter><StaffClaimsPage /></MemoryRouter>);
    const card = await screen.findByRole('article', { name: /Plat froid/ });
    await userEvent.selectOptions(within(card).getByLabelText('Décision proposée'), 'accept');
    await userEvent.type(within(card).getByLabelText('Réponse à l’étudiant'), 'Nous nous excusons, geste commercial.');
    await userEvent.click(within(card).getByRole('button', { name: 'Proposer' }));
    await waitFor(() => expect(api.propose).toHaveBeenCalledWith('s1', 'accept', 'Nous nous excusons, geste commercial.'));
    expect(within(card).queryByRole('button', { name: 'Valider' })).toBeNull();
  });
  it('le gérant valide ou rejette une proposition', async () => {
    asRole('manager');
    api.staffList.mockResolvedValue([staffClaim({ status: 'pending_validation', proposedDecision: 'accept', proposedResponse: 'Geste commercial.' })]);
    api.validate.mockResolvedValue(staffClaim({ status: 'resolved' }));
    render(<MemoryRouter><StaffClaimsPage /></MemoryRouter>);
    const card = await screen.findByRole('article', { name: /Plat froid/ });
    expect(within(card).getByText(/Geste commercial/)).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(api.validate).toHaveBeenCalledWith('s1', undefined));
  });
  it('le gérant rejette avec une note', async () => {
    asRole('manager');
    api.staffList.mockResolvedValue([staffClaim({ status: 'pending_validation', proposedDecision: 'refuse', proposedResponse: 'Refusé.' })]);
    api.reject.mockResolvedValue(staffClaim());
    render(<MemoryRouter><StaffClaimsPage /></MemoryRouter>);
    const card = await screen.findByRole('article', { name: /Plat froid/ });
    await userEvent.type(within(card).getByLabelText('Note pour l’employé'), 'Merci de proposer un geste.');
    await userEvent.click(within(card).getByRole('button', { name: 'Renvoyer' }));
    await waitFor(() => expect(api.reject).toHaveBeenCalledWith('s1', 'Merci de proposer un geste.'));
  });
  it('seul l’administrateur valide une réclamation de points, avec un nombre limité à la demande', async () => {
    const points = staffClaim({ kind: 'points', requestedPoints: 5, status: 'pending_validation', proposedDecision: 'accept', proposedResponse: 'Points accordés.' });
    api.staffList.mockResolvedValue([points]);
    api.validate.mockResolvedValue(staffClaim({ status: 'resolved' }));
    asRole('manager');
    const { unmount } = render(<MemoryRouter><StaffClaimsPage /></MemoryRouter>);
    const managerCard = await screen.findByRole('article', { name: /Plat froid/ });
    expect(within(managerCard).queryByRole('button', { name: 'Valider' })).toBeNull();
    expect(within(managerCard).getByText(/administrateur/i)).toBeInTheDocument();
    unmount();
    asRole('admin');
    render(<MemoryRouter><StaffClaimsPage /></MemoryRouter>);
    const card = await screen.findByRole('article', { name: /Plat froid/ });
    const input = within(card).getByLabelText('Points accordés');
    await userEvent.clear(input);
    await userEvent.type(input, '9');
    await userEvent.click(within(card).getByRole('button', { name: 'Valider' }));
    expect(api.validate).not.toHaveBeenCalled();
    await userEvent.clear(input);
    await userEvent.type(input, '4');
    await userEvent.click(within(card).getByRole('button', { name: 'Valider' }));
    await waitFor(() => expect(api.validate).toHaveBeenCalledWith('s1', 4));
  });
  it('filtre par état', async () => {
    asRole('manager');
    api.staffList.mockResolvedValue([]);
    render(<MemoryRouter><StaffClaimsPage /></MemoryRouter>);
    await waitFor(() => expect(api.staffList).toHaveBeenCalledWith(undefined));
    await userEvent.click(screen.getByRole('tab', { name: /À valider/ }));
    await waitFor(() => expect(api.staffList).toHaveBeenCalledWith('pending_validation'));
  });
});
