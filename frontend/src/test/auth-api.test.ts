import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../models/api.ts';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'test', user: {} }), {
    status: 200, headers: { 'content-type': 'application/json' },
  })));
});

afterEach(() => vi.unstubAllGlobals());

describe('Raccordement de la connexion à l’API', () => {
  it('utilise le préfixe /api une seule fois pour se connecter', async () => {
    const data = { identifier: 'admin@example.test', password: 'ExampleTest1' };
    await authApi.login(data);
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST', body: JSON.stringify(data),
    }));
  });
});
