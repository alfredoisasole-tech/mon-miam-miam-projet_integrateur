import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../models/http.ts';
import { ApiError } from '../models/types.ts';

describe('client HTTP', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn();
  });

  it('ajoute le jeton dans Authorization', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await http.get('/api/me', 'MON_JETON');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer MON_JETON',
        }),
      }),
    );
  });

  it('lit erreur 400 renvoyee par API', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 'INVALID_EMAIL', message: 'E-mail invalide' },
      }),
    });

    await expect(http.post('/api/auth/register', {})).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_EMAIL',
      message: 'E-mail invalide',
    });
  });

  it('renvoie message francais si reseau coupe', async () => {
    (globalThis.fetch as any).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(http.get('/api/me')).rejects.toBeInstanceOf(ApiError);
    await expect(http.get('/api/me')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });
});