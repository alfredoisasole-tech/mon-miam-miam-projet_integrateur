import { afterEach, expect, it, vi } from 'vitest';
import { adminMenuApi } from '../controllers/adminMenu';

afterEach(() => vi.unstubAllGlobals());

it('envoie les opérations du menu aux routes API sans doubler le préfixe', async () => {
  const dish = { name: 'Pondu', description: 'Feuilles de manioc', priceFc: 2500, category: 'plat' as const, isDaily: false, isAvailable: true };
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ id: 'pondu', ...dish }));
  vi.stubGlobal('fetch', fetchMock);
  await adminMenuApi.createDish(dish);
  await adminMenuApi.updateDish('pondu', { priceFc: 3000 });
  await adminMenuApi.staffUpdate('pondu', { isAvailable: false });
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await adminMenuApi.deleteDish('pondu');
  expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
    ['/api/admin/menu', 'POST'], ['/api/admin/menu/pondu', 'PATCH'],
    ['/api/staff/menu/pondu', 'PATCH'], ['/api/admin/menu/pondu', 'DELETE'],
  ]);
});
