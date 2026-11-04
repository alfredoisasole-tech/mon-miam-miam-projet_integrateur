import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulatedPaymentPage } from '../views/pages/SimulatedPaymentPage.tsx';
import { paymentApi } from '../controllers/payment.ts';

function mount() {
  render(<MemoryRouter initialEntries={['/paiement/simulation/pay_1']}><Routes>
    <Route path="/paiement/simulation/:paymentId" element={<SimulatedPaymentPage />} />
    <Route path="/orders" element={<p>Mes commandes</p>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => vi.restoreAllMocks());
afterEach(cleanup);

describe('Paiement simulé', () => {
  it('annonce clairement qu’aucun argent n’est débité', () => {
    mount();
    expect(screen.getByText(/aucun argent n’est débité/)).toBeInTheDocument();
  });

  it.each([['Approuver le paiement', 'paid'], ['Simuler un échec', 'failed']] as const)('« %s » envoie le résultat %s puis renvoie vers les commandes', async (label, outcome) => {
    const simulate = vi.spyOn(paymentApi, 'simulate').mockResolvedValue({ paymentId: 'pay_1', status: outcome });
    mount();
    await userEvent.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(simulate).toHaveBeenCalledWith('pay_1', outcome));
    expect(await screen.findByText('Mes commandes')).toBeInTheDocument();
  });

  it('annuler ne touche pas au paiement', async () => {
    const simulate = vi.spyOn(paymentApi, 'simulate');
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(await screen.findByText('Mes commandes')).toBeInTheDocument();
    expect(simulate).not.toHaveBeenCalled();
  });

  it('affiche l’erreur du serveur, par exemple quand la simulation est désactivée', async () => {
    vi.spyOn(paymentApi, 'simulate').mockRejectedValue(new Error('Route introuvable.'));
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Approuver le paiement' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Route introuvable.');
    expect(screen.getByRole('button', { name: 'Approuver le paiement' })).toBeEnabled();
  });
});
