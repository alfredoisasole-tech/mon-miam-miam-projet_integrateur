import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ordersApi } from '../controllers/orders.ts';
import type { Order } from '../controllers/orders.ts';
import { MyOrdersPage } from '../views/pages/MyOrdersPage.tsx';

vi.mock('../controllers/orders.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../controllers/orders.ts')>()),
  ordersApi: { list: vi.fn(), get: vi.fn(), cancel: vi.fn(), review: vi.fn() },
}));
const api = vi.mocked(ordersApi);

const order = (over: Partial<Order> = {}): Order => ({
  id: 'o1', orderNumber: '261103-001', restaurant: { slug: 'zeduc-space', name: 'ZeDuc@Space' }, type: 'dine_in',
  status: 'preparing', paymentMethod: 'cash', paymentStatus: 'unpaid',
  items: [{ menuItemId: 'm1', name: 'Poulet braisé', unitPriceFc: 4500, quantity: 1, lineTotalFc: 4500 }],
  subtotalFc: 4500, discountFc: 0, deliveryFeeFc: 0, totalFc: 4500, pointsRedeemed: 0, pointsEarned: 0,
  arrivalTime: null, delivery: null, note: null, comment: null, rating: null,
  createdAt: '2026-11-03T09:00:00Z', updatedAt: '2026-11-03T09:05:00Z', completedAt: null, cancelledAt: null, ...over,
});
const page = (items: Order[]) => ({ items, total: items.length, page: 1, pageSize: 20 });
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
const mount = () => render(<MemoryRouter><MyOrdersPage /></MemoryRouter>);

describe('Mes commandes', () => {
  it('affiche un message quand il n’y a aucune commande', async () => {
    api.list.mockResolvedValue(page([]));
    mount();
    expect(await screen.findByText(/pas encore passé de commande/i)).toBeInTheDocument();
  });
  it('affiche le restaurant, le numéro, l’état et le total', async () => {
    api.list.mockResolvedValue(page([order()]));
    mount();
    const card = await screen.findByRole('article', { name: /261103-001/ });
    expect(within(card).getByText('ZeDuc@Space')).toBeInTheDocument();
    expect(within(card).getByText('En préparation')).toBeInTheDocument();
    expect(within(card).getByText('1 × Poulet braisé')).toBeInTheDocument();
    expect(within(card).getByText(/4\s?500 FC/, { selector: 'strong' })).toBeInTheDocument();
  });
  it.each([
    ['pending', 'En attente de confirmation'], ['confirmed', 'Confirmée'], ['ready', 'Prête'],
    ['out_for_delivery', 'En cours de livraison'], ['completed', 'Terminée'], ['cancelled', 'Annulée'],
  ] as const)('traduit l’état %s', async (status, label) => {
    api.list.mockResolvedValue(page([order({ status })]));
    mount();
    expect(await screen.findByText(label)).toBeInTheDocument();
  });
  it('affiche l’historique de la commande à la demande', async () => {
    api.list.mockResolvedValue(page([order()]));
    api.get.mockResolvedValue({ ...order(), events: [{ status: 'pending', at: '2026-11-03T09:00:00Z' }, { status: 'confirmed', at: '2026-11-03T09:02:00Z' }] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Suivre la commande' }));
    expect(await screen.findByText('Confirmée')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('o1');
  });
  it('annule une commande en attente non payée après confirmation', async () => {
    api.list.mockResolvedValue(page([order({ status: 'pending' })]));
    api.cancel.mockResolvedValue({ ...order({ status: 'cancelled' }), events: [] });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la commande' }));
    await userEvent.click(screen.getByRole('button', { name: 'Oui, annuler' }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith('o1'));
  });
  it('ne propose pas d’annuler une commande déjà confirmée ou payée en mobile money', async () => {
    api.list.mockResolvedValue(page([order({ status: 'confirmed' }), order({ id: 'o2', orderNumber: '261103-002', status: 'pending', paymentMethod: 'mobile_money', paymentStatus: 'pending' })]));
    mount();
    await screen.findByRole('article', { name: /261103-001/ });
    expect(screen.queryByRole('button', { name: 'Annuler la commande' })).toBeNull();
  });
  it('permet de noter une commande terminée une seule fois', async () => {
    api.list.mockResolvedValue(page([order({ status: 'completed' })]));
    api.review.mockResolvedValue({ orderId: 'o1', rating: 4, comment: 'Très bon', commentedAt: '2026-11-03T12:00:00Z' });
    mount();
    await userEvent.click(await screen.findByRole('radio', { name: '4 sur 5' }));
    await userEvent.type(screen.getByLabelText('Commentaire (facultatif)'), 'Très bon');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer mon avis' }));
    await waitFor(() => expect(api.review).toHaveBeenCalledWith('o1', 4, 'Très bon'));
    expect(await screen.findByText(/merci pour votre avis/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer mon avis' })).toBeNull();
  });
  it('affiche l’avis déjà donné et ne redemande pas', async () => {
    api.list.mockResolvedValue(page([order({ status: 'completed', rating: 5, comment: 'Excellent' })]));
    mount();
    expect(await screen.findByText(/Excellent/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer mon avis' })).toBeNull();
  });
  it('actualise les commandes en cours toutes les 15 secondes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.list.mockResolvedValue(page([order()]));
    mount();
    await screen.findByRole('article', { name: /261103-001/ });
    expect(api.list).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(api.list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
  it('affiche une erreur si le chargement échoue', async () => {
    api.list.mockRejectedValue(new Error('hors ligne'));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger vos commandes.');
  });
});
