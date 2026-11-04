import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminSettingsPage } from '../views/pages/AdminSettingsPage.tsx';
import { settingsApi, type Settings } from '../controllers/settings.ts';

vi.mock('../controllers/settings.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../controllers/settings.ts')>()),
  settingsApi: { get: vi.fn(), update: vi.fn(), uploadLogo: vi.fn() },
}));
const api = vi.mocked(settingsApi);

const settings: Settings = {
  restaurant: { slug: 'zeduc-space', name: 'ZeDuc@Space', tagline: 'Le goût de la terrasse' },
  brand: { primaryColor: '#cfbd97', secondaryColor: '#000000', fontFamily: 'Poppins', defaultMode: 'light', logoAssetId: null, logoUrl: null },
  openingHours: { mon: [{ open: '10:00', close: '22:00' }] },
  delivery: { enabled: true, feeFc: 1000, communes: ['Gombe', 'Limete'] },
  loyalty: { spendPerPointFc: 3000, pointsForReward: 15, rewardValueFc: 3000, validityMonths: 12 },
};
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue(structuredClone(settings)); });
afterEach(cleanup);

async function ouvrir() {
  render(<AdminSettingsPage />);
  await screen.findByLabelText('Nom du restaurant');
}

describe('Paramètres du restaurant', () => {
  it('affiche les réglages actuels', async () => {
    await ouvrir();
    expect(screen.getByLabelText('Nom du restaurant')).toHaveValue('ZeDuc@Space');
    expect(screen.getByLabelText('Couleur principale')).toHaveValue('#cfbd97');
    expect(screen.getByLabelText('Police')).toHaveValue('Poppins');
    expect(screen.getByLabelText('Frais de livraison (FC)')).toHaveValue(1000);
    expect(screen.getByLabelText('Communes desservies')).toHaveValue('Gombe, Limete');
    expect(screen.getByLabelText('Dépense pour 1 point (FC)')).toHaveValue(3000);
  });

  it('n’envoie que les blocs modifiés', async () => {
    api.update.mockResolvedValue({ ...settings, brand: { ...settings.brand, primaryColor: '#112233' } });
    await ouvrir();
    fireEvent.change(screen.getByLabelText('Couleur principale'), { target: { value: '#112233' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ brand: { primaryColor: '#112233' } }));
    expect(await screen.findByRole('status')).toHaveTextContent('enregistrés');
  });

  it('refuse une couleur invalide sans appeler le serveur', async () => {
    await ouvrir();
    fireEvent.change(screen.getByLabelText('Couleur principale'), { target: { value: 'rouge' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText(/six chiffres/i)).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('transforme les communes en liste et les horaires en plages', async () => {
    api.update.mockResolvedValue(settings);
    await ouvrir();
    fireEvent.change(screen.getByLabelText('Communes desservies'), { target: { value: 'Gombe,  Ngaliema , ' } });
    fireEvent.change(screen.getByLabelText('Mardi ouverture'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText('Mardi fermeture'), { target: { value: '18:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    const body = api.update.mock.calls[0][0];
    expect(body.delivery).toEqual({ communes: ['Gombe', 'Ngaliema'] });
    expect(body.openingHours).toEqual({ mon: [{ open: '10:00', close: '22:00' }], tue: [{ open: '09:00', close: '18:00' }] });
  });

  it('refuse une fermeture avant l’ouverture', async () => {
    await ouvrir();
    fireEvent.change(screen.getByLabelText('Lundi fermeture'), { target: { value: '08:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText(/avant la fermeture/i)).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('envoie le logo puis l’enregistre dans la charte', async () => {
    api.uploadLogo.mockResolvedValue({ id: 'ast_9', url: '/api/restaurants/zeduc-space/assets/ast_9' });
    api.update.mockResolvedValue(settings);
    await ouvrir();
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Logo'), file);
    await waitFor(() => expect(api.uploadLogo).toHaveBeenCalledWith(file));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ brand: { logoAssetId: 'ast_9' } }));
  });

  it('refuse un logo trop lourd ou au mauvais format', async () => {
    await ouvrir();
    const big = new File([new Uint8Array(600 * 1024)], 'gros.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Logo'), big);
    expect(await screen.findByRole('alert')).toHaveTextContent('512 Ko');
    expect(api.uploadLogo).not.toHaveBeenCalled();
  });

  it('affiche le message du serveur en cas d’échec', async () => {
    api.update.mockRejectedValue(new Error('Valeur refusée par le serveur.'));
    await ouvrir();
    fireEvent.change(screen.getByLabelText('Nom du restaurant'), { target: { value: 'Nouveau nom' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Valeur refusée');
  });
});
