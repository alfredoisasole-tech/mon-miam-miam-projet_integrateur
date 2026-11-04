import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartPage } from '../views/pages/CartPage.tsx';
import { MyOrdersPage } from '../views/pages/MyOrdersPage.tsx';
import { CartProvider } from '../controllers/cart.tsx';
import { AuthProvider } from '../controllers/session.tsx';
import { api } from '../models/http.ts';
import { ordersApi, canPay } from '../controllers/orders.ts';
import type { Order } from '../controllers/orders.ts';
import { paymentApi } from '../controllers/payment.ts';
import { isValidPaymentPhone, normalizePaymentPhone } from '../views/components/PaymentDetails.tsx';

vi.mock('../controllers/payment.ts', () => ({ paymentApi: { startPayment: vi.fn() } }));
vi.mock('../controllers/orders.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../controllers/orders.ts')>()),
  ordersApi: { list: vi.fn(), get: vi.fn(), cancel: vi.fn(), review: vi.fn() },
}));

const assign = vi.fn();
const order = (over: Partial<Order> = {}): Order => ({
  id: 'o1', orderNumber: '261104-001', restaurant: { slug: 'chez-lea', name: 'Chez Léa' }, type: 'dine_in',
  status: 'pending', paymentMethod: 'mobile_money', paymentStatus: 'unpaid',
  items: [{ menuItemId: 'm1', name: 'Poulet braisé', unitPriceFc: 500, quantity: 1, lineTotalFc: 500 }],
  subtotalFc: 500, discountFc: 0, deliveryFeeFc: 0, totalFc: 500, pointsRedeemed: 0, pointsEarned: 0,
  arrivalTime: null, delivery: null, note: null, comment: null, rating: null,
  createdAt: '2026-11-04T09:00:00Z', updatedAt: '2026-11-04T09:00:00Z', completedAt: null, cancelledAt: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal('location', { ...window.location, assign });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Numéro Mobile Money', () => {
  it('accepte les écritures usuelles et ajoute l’indicatif', () => {
    expect(normalizePaymentPhone('0991429583')).toBe('+243991429583');
    expect(normalizePaymentPhone('99 142 95 83')).toBe('+243991429583');
    expect(normalizePaymentPhone('243991429583')).toBe('+243991429583');
    expect(normalizePaymentPhone('+243991429583')).toBe('+243991429583');
    expect(isValidPaymentPhone('0991429583')).toBe(true);
    expect(isValidPaymentPhone('12')).toBe(false);
  });
});

describe('Quand peut-on payer une commande', () => {
  it('seulement en attente, en mobile money, avec un montant et sans paiement abouti', () => {
    expect(canPay(order())).toBe(true);
    expect(canPay(order({ paymentStatus: 'pending' }))).toBe(true);
    expect(canPay(order({ paymentStatus: 'failed' }))).toBe(true);
    expect(canPay(order({ paymentStatus: 'paid' }))).toBe(false);
    expect(canPay(order({ paymentMethod: 'cash' }))).toBe(false);
    expect(canPay(order({ totalFc: 0 }))).toBe(false);
    expect(canPay(order({ status: 'confirmed' }))).toBe(false);
  });
});

describe('Panier : paiement mobile money', () => {
  async function mountCart() {
    localStorage.setItem('mmm_cart', JSON.stringify({ restaurantSlug: 'chez-lea', lines: [{ id: 'd1', name: 'Poulet braisé', restaurantSlug: 'chez-lea', unitPriceFc: 500, quantity: 1 }] }));
    localStorage.setItem('mmm_token', 'fake-token');
    vi.spyOn(api, 'get').mockImplementation(async (path: string) => (path === '/me'
      ? { id: 'student-1', name: 'Alex', email: 'alex@example.com', role: 'student' }
      : { restaurant: { slug: 'chez-lea', name: 'Chez Léa' }, availablePoints: 0, remainderFc: 0, canRedeem: false,
        rules: { spendPerPointFc: 3000, pointsForReward: 15, rewardValueFc: 3000, validityMonths: 12 }, movements: [] }) as never);
    render(<AuthProvider><CartProvider><MemoryRouter><CartPage /></MemoryRouter></CartProvider></AuthProvider>);
    await screen.findByTestId('confirm-order-button');
  }

  it('demande l’opérateur et le numéro seulement pour le mobile money', async () => {
    await mountCart();
    expect(screen.queryByLabelText('Numéro Mobile Money')).toBeNull();
    await userEvent.click(screen.getByTestId('radio-mobile-money'));
    expect(screen.getByLabelText('Opérateur Mobile Money')).toBeInTheDocument();
    expect(screen.getByLabelText('Numéro Mobile Money')).toBeInTheDocument();
  });

  it('refuse un numéro invalide sans créer la commande', async () => {
    await mountCart();
    const post = vi.spyOn(api, 'post');
    await userEvent.click(screen.getByTestId('radio-mobile-money'));
    await userEvent.type(screen.getByLabelText('Numéro Mobile Money'), '12');
    await userEvent.click(screen.getByTestId('confirm-order-button'));
    expect(await screen.findByText(/numéro Mobile Money valide/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('crée la commande, démarre le paiement puis redirige vers Easypay', async () => {
    await mountCart();
    vi.spyOn(api, 'post').mockResolvedValue({ id: 'ord_1', orderNumber: '261104-002' });
    vi.mocked(paymentApi.startPayment).mockResolvedValue({ paymentId: 'pay_1', status: 'pending', amountFc: 500, redirectUrl: 'https://www.e-com-easypay.com/sandbox/payment/initialization?reference=abc' });
    await userEvent.click(screen.getByTestId('radio-mobile-money'));
    await userEvent.selectOptions(screen.getByLabelText('Opérateur Mobile Money'), 'orange_money');
    await userEvent.type(screen.getByLabelText('Numéro Mobile Money'), '0991429583');
    await userEvent.click(screen.getByTestId('confirm-order-button'));
    await waitFor(() => expect(paymentApi.startPayment).toHaveBeenCalledWith('ord_1', { operator: 'orange_money', phone: '+243991429583' }));
    expect(assign).toHaveBeenCalledWith('https://www.e-com-easypay.com/sandbox/payment/initialization?reference=abc');
  });

  it('garde la commande et explique l’échec quand le paiement ne démarre pas', async () => {
    await mountCart();
    vi.spyOn(api, 'post').mockResolvedValue({ id: 'ord_1', orderNumber: '261104-002' });
    vi.mocked(paymentApi.startPayment).mockRejectedValue(new Error('Le service de paiement est momentanément indisponible.'));
    await userEvent.click(screen.getByTestId('radio-mobile-money'));
    await userEvent.type(screen.getByLabelText('Numéro Mobile Money'), '0991429583');
    await userEvent.click(screen.getByTestId('confirm-order-button'));
    expect(await screen.findByTestId('order-confirmed')).toHaveTextContent('momentanément indisponible');
    expect(assign).not.toHaveBeenCalled();
  });

  it('ne démarre aucun paiement pour une commande en espèces', async () => {
    await mountCart();
    vi.spyOn(api, 'post').mockResolvedValue({ id: 'ord_1', orderNumber: '261104-002' });
    await userEvent.click(screen.getByTestId('confirm-order-button'));
    await screen.findByTestId('order-confirmed');
    expect(paymentApi.startPayment).not.toHaveBeenCalled();
  });
});

describe('Mes commandes : paiement', () => {
  const mount = (path = '/orders') => render(<MemoryRouter initialEntries={[path]}><MyOrdersPage /></MemoryRouter>);
  const list = (items: Order[]) => vi.mocked(ordersApi.list).mockResolvedValue({ items, total: items.length, page: 1, pageSize: 20 });

  it('propose de payer une commande mobile money impayée et redirige vers Easypay', async () => {
    list([order()]);
    vi.mocked(paymentApi.startPayment).mockResolvedValue({ paymentId: 'pay_1', status: 'pending', amountFc: 500, redirectUrl: 'https://pay.example/redirect' });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Payer par Mobile Money' }));
    await userEvent.type(screen.getByLabelText('Numéro Mobile Money'), '0991429583');
    await userEvent.click(screen.getByRole('button', { name: /^Payer 500/ }));
    await waitFor(() => expect(paymentApi.startPayment).toHaveBeenCalledWith('o1', { operator: 'mpesa', phone: '+243991429583' }));
    expect(assign).toHaveBeenCalledWith('https://pay.example/redirect');
  });

  it('propose de reprendre un paiement déjà commencé', async () => {
    list([order({ paymentStatus: 'pending' })]);
    mount();
    expect(await screen.findByRole('button', { name: 'Reprendre le paiement' })).toBeInTheDocument();
  });

  it('ne propose pas de payer une commande en espèces ou déjà payée', async () => {
    list([order({ paymentMethod: 'cash' }), order({ id: 'o2', orderNumber: '261104-002', paymentStatus: 'paid', status: 'confirmed' })]);
    mount();
    await screen.findByRole('article', { name: /261104-002/ });
    expect(screen.queryByRole('button', { name: /Payer|Reprendre le paiement/ })).toBeNull();
  });

  it('affiche le message de retour d’Easypay', async () => {
    list([order({ paymentStatus: 'pending' })]);
    mount('/orders?commande=o1&paiement=succes');
    expect(await screen.findByText(/Paiement reçu/)).toBeInTheDocument();
    cleanup();
    mount('/orders?commande=o1&paiement=annule');
    expect(await screen.findByText(/Paiement annulé/)).toBeInTheDocument();
    cleanup();
    mount('/orders?commande=o1&paiement=erreur');
    expect(await screen.findByText(/Le paiement a échoué/)).toBeInTheDocument();
  });
});
