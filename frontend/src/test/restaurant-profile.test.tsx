import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../models/http.ts';
import { announceRestaurantUpdated, useRestaurantProfile } from '../controllers/useRestaurantProfile.ts';
vi.mock('../models/http.ts', () => ({ api: { get: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
it('ignore les réponses tardives du restaurant précédent et efface le profil sans sélection', async () => {
  let resolveFirst!: (data: unknown) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValueOnce({ slug: 'b', name: 'Restaurant B', colors: {} });
  const { result, rerender } = renderHook(({ slug }) => useRestaurantProfile(slug), { initialProps: { slug: 'a' as string | null } });
  rerender({ slug: 'b' });
  await waitFor(() => expect(result.current.restaurant?.name).toBe('Restaurant B'));
  await act(async () => resolveFirst({ slug: 'a', name: 'Ancien restaurant', colors: {} }));
  expect(result.current.restaurant?.name).toBe('Restaurant B');
  rerender({ slug: null });
  expect(result.current.restaurant).toBeNull();
});
it('n’appelle pas l’API sans restaurant et expose une erreur de profil', async () => {
  const { result, rerender } = renderHook(({ slug }) => useRestaurantProfile(slug), { initialProps: { slug: null as string | null } });
  expect(api.get).not.toHaveBeenCalled();
  vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));
  rerender({ slug: 'a/b' });
  await waitFor(() => expect(result.current.error).toMatch(/indisponible/));
  expect(api.get).toHaveBeenCalledWith('/restaurants/a%2Fb');
});
it('recharge le profil quand le restaurant vient d’être personnalisé, sans recharger la page', async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce({ slug: 'a', name: 'Restaurant A', colors: { primary: '#cfbd97', secondary: '#000000' } })
    .mockResolvedValueOnce({ slug: 'a', name: 'Restaurant A', colors: { primary: '#2e7d32', secondary: '#14301a' } });
  const { result } = renderHook(() => useRestaurantProfile('a'));
  await waitFor(() => expect(result.current.restaurant?.colors.primary).toBe('#cfbd97'));
  await act(async () => { announceRestaurantUpdated(); });
  await waitFor(() => expect(result.current.restaurant?.colors.primary).toBe('#2e7d32'));
  expect(api.get).toHaveBeenCalledTimes(2);
});
