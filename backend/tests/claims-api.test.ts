import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import type { AuthenticatedUser } from '../src/domain/orders.ts';
import { demarrer, type Serveur } from './helpers.ts';

const NOW = new Date('2026-11-03T10:00:00.000Z');
const TOKENS = new Map<string, AuthenticatedUser>([
  ['student-a', { id: 'student-a', role: 'student', restaurantId: 'restaurant-a', status: 'active' }],
  ['student-b', { id: 'student-b', role: 'student', restaurantId: 'restaurant-b', status: 'active' }],
  ['employee-a', { id: 'employee-a', role: 'employee', restaurantId: 'restaurant-a', status: 'active' }],
  ['manager-a', { id: 'manager-a', role: 'manager', restaurantId: 'restaurant-a', status: 'active' }],
  ['admin-a', { id: 'admin-a', role: 'admin', restaurantId: 'restaurant-a', status: 'active' }],
  ['employee-b', { id: 'employee-b', role: 'employee', restaurantId: 'restaurant-b', status: 'active' }],
  ['manager-b', { id: 'manager-b', role: 'manager', restaurantId: 'restaurant-b', status: 'active' }],
]);

interface ClaimBody {
  id: string; kind: string; status: string; decision: string | null; response: string | null; orderNumber: string | null;
  requestedPoints: number | null; proposal?: unknown; managerNote?: string | null; customer?: { name: string } | null;
  [key: string]: unknown;
}

describe('[MM-RECLAMATIONS] API des réclamations', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    const at = NOW.toISOString();
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('restaurant-a', 'rec-a', 'Restaurant A', 'Arial', ?), ('restaurant-b', 'rec-b', 'Restaurant B', 'Arial', ?)`, [at, at]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
      ('restaurant-a', '{}', ?), ('restaurant-b', '{}', ?)`, [at, at]);
    const users: Array<[string, string, string, string, string]> = [
      ['student-a', 'restaurant-a', 'student', 'Étudiant A', '+243810000101'],
      ['student-b', 'restaurant-b', 'student', 'Étudiant B', '+243810000102'],
      ['employee-a', 'restaurant-a', 'employee', 'Employé A', '+243810000103'],
      ['manager-a', 'restaurant-a', 'manager', 'Gérant A', '+243810000104'],
      ['admin-a', 'restaurant-a', 'admin', 'Admin A', '+243810000105'],
      ['employee-b', 'restaurant-b', 'employee', 'Employé B', '+243810000106'],
      ['manager-b', 'restaurant-b', 'manager', 'Gérant B', '+243810000107'],
    ];
    for (const [id, restaurant, role, name, phone] of users) {
      db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'x', ?)`, [id, restaurant, role, name, `${id}@example.test`, phone, at]);
    }
    db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES
      ('student-a', 'restaurant-a', ?), ('student-b', 'restaurant-b', ?)`, [at, at]);
    for (const [id, user, restaurant, number] of [['order-a', 'student-a', 'restaurant-a', '261103-001'], ['order-b', 'student-b', 'restaurant-b', '261103-001']] as const) {
      db.run(`INSERT INTO orders (id, restaurant_id, user_id, order_number, type, status, payment_method, payment_status,
        subtotal_fc, discount_fc, delivery_fee_fc, total_fc, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'dine_in', 'completed', 'cash', 'paid', 3000, 0, 0, 3000, ?, ?)`, [id, restaurant, user, number, at, at]);
    }
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db, now: () => new Date(NOW), resolveToken: (token) => TOKENS.get(token) ?? null,
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  function headers(token?: string): HeadersInit {
    return { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' };
  }

  async function post(path: string, token: string | undefined, body: unknown) {
    return fetch(`${server.base}${path}`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
  }

  async function get(path: string, token?: string) {
    return fetch(`${server.base}${path}`, { headers: headers(token) });
  }

  async function create(token: string, slug: string, body: Record<string, unknown>) {
    return post(`/api/restaurants/${slug}/claims`, token, body);
  }

  const order = { kind: 'order', orderId: 'order-a', subject: 'Plat manquant', message: 'Il manquait une boisson dans ma commande.' };

  it('crée une réclamation de commande visible seulement par son auteur', async () => {
    const response = await create('student-a', 'rec-a', order);
    assert.equal(response.status, 201);
    const claim = await response.json() as ClaimBody;
    assert.equal(claim.status, 'open');
    assert.equal(claim.kind, 'order');
    assert.equal(claim.orderNumber, '261103-001');
    assert.equal(claim.decision, null);

    const mine = await get('/api/restaurants/rec-a/claims', 'student-a');
    assert.equal(mine.status, 200);
    const list = await mine.json() as { items: ClaimBody[]; total: number };
    assert.ok(list.items.some((item) => item.id === claim.id));

    const own = await get(`/api/claims/${claim.id}`, 'student-a');
    assert.equal(own.status, 200);
    const other = await get(`/api/claims/${claim.id}`, 'student-b');
    assert.equal(other.status, 404);
  });

  it('refuse les accès non autorisés et les données invalides', async () => {
    assert.equal((await post('/api/restaurants/rec-a/claims', undefined, order)).status, 401);
    assert.equal((await create('employee-a', 'rec-a', order)).status, 403);
    assert.equal((await create('student-b', 'rec-a', order)).status, 403);
    assert.equal((await create('student-a', 'inconnu', order)).status, 404);
    assert.equal((await create('student-a', 'rec-a', { ...order, orderId: undefined })).status, 400);
    assert.equal((await create('student-a', 'rec-a', { kind: 'points', subject: 'Points manquants', message: 'Mes points ne sont pas arrivés.' })).status, 400);
    assert.equal((await create('student-a', 'rec-a', { ...order, subject: 'ab' })).status, 400);
    assert.equal((await create('student-a', 'rec-a', { ...order, message: 'trop bref' })).status, 400);
    assert.equal((await create('student-a', 'rec-a', { ...order, kind: 'inconnu' })).status, 400);
    const foreign = await create('student-a', 'rec-a', { ...order, orderId: 'order-b' });
    assert.equal(foreign.status, 422);
    assert.equal(((await foreign.json()) as { error: { code: string } }).error.code, 'ORDER_NOT_FOUND');
  });

  it('limite à cinq les réclamations non résolues d’un étudiant', async () => {
    const other = { kind: 'other', subject: 'Question générale', message: 'Une question sur le restaurant, merci.' };
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) statuses.push((await create('student-b', 'rec-b', other)).status);
    assert.deepEqual(statuses, [201, 201, 201, 201, 201, 409]);
    const refused = await create('student-b', 'rec-b', other);
    assert.equal(((await refused.json()) as { error: { code: string } }).error.code, 'TOO_MANY_OPEN_CLAIMS');
  });

  it('suit le circuit : l’employé propose, le gérant valide, l’étudiant ne voit qu’après validation', async () => {
    const created = await (await create('student-a', 'rec-a', { ...order, subject: 'Retard de livraison' })).json() as ClaimBody;

    assert.equal((await get('/api/staff/claims', 'student-a')).status, 403);
    assert.equal((await get('/api/staff/claims')).status, 401);
    const queue = await (await get('/api/staff/claims', 'employee-a')).json() as { items: ClaimBody[] };
    assert.ok(queue.items.some((item) => item.id === created.id && item.customer?.name === 'Étudiant A'));

    assert.equal((await post(`/api/staff/claims/${created.id}/propose`, 'employee-a', { decision: 'accept', response: 'ok' })).status, 400);
    const proposed = await post(`/api/staff/claims/${created.id}/propose`, 'employee-a', { decision: 'accept', response: 'Nous vous offrons une boisson.' });
    assert.equal(proposed.status, 200);
    assert.equal(((await proposed.json()) as ClaimBody).status, 'pending_validation');
    assert.equal((await post(`/api/staff/claims/${created.id}/propose`, 'employee-a', { decision: 'refuse', response: 'Deuxième avis.' })).status, 409);

    const hidden = await (await get(`/api/claims/${created.id}`, 'student-a')).json() as ClaimBody;
    assert.equal(hidden.status, 'in_review');
    assert.equal(hidden.response, null);
    assert.equal(hidden.decision, null);

    assert.equal((await post(`/api/staff/claims/${created.id}/validate`, 'employee-a', {})).status, 403);
    const validated = await post(`/api/staff/claims/${created.id}/validate`, 'manager-a', {});
    assert.equal(validated.status, 200);
    assert.equal(((await validated.json()) as ClaimBody).status, 'resolved');

    const visible = await (await get(`/api/claims/${created.id}`, 'student-a')).json() as ClaimBody;
    assert.equal(visible.status, 'resolved');
    assert.equal(visible.decision, 'accept');
    assert.equal(visible.response, 'Nous vous offrons une boisson.');
    assert.equal((await post(`/api/staff/claims/${created.id}/validate`, 'manager-a', {})).status, 409);
  });

  it('permet au gérant de renvoyer une proposition avec une consigne', async () => {
    const created = await (await create('student-a', 'rec-a', { ...order, subject: 'Erreur de prix' })).json() as ClaimBody;
    assert.equal((await post(`/api/staff/claims/${created.id}/reject`, 'manager-a', { note: 'À reprendre' })).status, 409);
    await post(`/api/staff/claims/${created.id}/propose`, 'employee-a', { decision: 'refuse', response: 'Le prix était correct.' });
    assert.equal((await post(`/api/staff/claims/${created.id}/reject`, 'employee-a', { note: 'À reprendre' })).status, 403);
    assert.equal((await post(`/api/staff/claims/${created.id}/reject`, 'manager-a', { note: '' })).status, 400);
    const rejected = await post(`/api/staff/claims/${created.id}/reject`, 'manager-a', { note: 'Précisez le prix payé.' });
    assert.equal(rejected.status, 200);
    const claim = await rejected.json() as ClaimBody;
    assert.equal(claim.status, 'open');
    assert.equal(claim.managerNote, 'Précisez le prix payé.');
    assert.equal(claim.proposal, null);
  });

  it('isole les réclamations par restaurant', async () => {
    const created = await (await create('student-a', 'rec-a', { ...order, subject: 'Isolation A' })).json() as ClaimBody;
    const listB = await (await get('/api/staff/claims?status=open', 'employee-b')).json() as { items: ClaimBody[] };
    assert.ok(listB.items.every((item) => item.id !== created.id));
    assert.equal((await get(`/api/staff/claims/${created.id}`, 'employee-b')).status, 404);
    assert.equal((await post(`/api/staff/claims/${created.id}/propose`, 'employee-b', { decision: 'accept', response: 'Réponse interdite.' })).status, 404);
    assert.equal((await post(`/api/staff/claims/${created.id}/validate`, 'manager-b', {})).status, 404);
    assert.equal((await post(`/api/staff/claims/${created.id}/reject`, 'manager-b', { note: 'Interdit' })).status, 404);
    assert.equal(db.get<{ status: string }>('SELECT status FROM claims WHERE id = ?', [created.id])?.status, 'open');
  });

  it('réserve les réclamations de points à l’administrateur, qui accorde les points', async () => {
    const created = await (await create('student-a', 'rec-a', {
      kind: 'points', subject: 'Points manquants', message: 'Mes points de la commande ne sont pas arrivés.', requestedPoints: 3,
    })).json() as ClaimBody;
    assert.equal(created.requestedPoints, 3);
    await post(`/api/staff/claims/${created.id}/propose`, 'employee-a', { decision: 'accept', response: 'Nous créditons vos points.' });

    const byManager = await post(`/api/staff/claims/${created.id}/validate`, 'manager-a', {});
    assert.equal(byManager.status, 403);
    assert.equal(((await byManager.json()) as { error: { code: string } }).error.code, 'POINTS_CLAIM_ADMIN_ONLY');
    assert.equal((await post(`/api/staff/claims/${created.id}/validate`, 'admin-a', { grantedPoints: 4 })).status, 400);

    const granted = await post(`/api/staff/claims/${created.id}/validate`, 'admin-a', { grantedPoints: 2 });
    assert.equal(granted.status, 200);
    const entry = db.get<{ kind: string; points: number; remaining: number; restaurant_id: string; user_id: string; expires_at: string | null; created_by: string }>(
      "SELECT kind, points, remaining, restaurant_id, user_id, expires_at, created_by FROM points_ledger WHERE user_id = 'student-a' AND kind = 'adjust'",
    );
    assert.deepEqual(entry && { kind: entry.kind, points: entry.points, remaining: entry.remaining, restaurant: entry.restaurant_id, by: entry.created_by },
      { kind: 'adjust', points: 2, remaining: 2, restaurant: 'restaurant-a', by: 'admin-a' });
    assert.ok(entry?.expires_at && entry.expires_at > NOW.toISOString());

    const refusedPoints = await (await create('student-a', 'rec-a', {
      kind: 'points', subject: 'Autres points', message: 'Je réclame aussi des points supplémentaires.', requestedPoints: 5,
    })).json() as ClaimBody;
    await post(`/api/staff/claims/${refusedPoints.id}/propose`, 'employee-a', { decision: 'refuse', response: 'Aucun point dû.' });
    assert.equal((await post(`/api/staff/claims/${refusedPoints.id}/validate`, 'admin-a', {})).status, 200);
    assert.equal(db.get<{ total: number }>("SELECT COUNT(*) AS total FROM points_ledger WHERE user_id = 'student-a' AND kind = 'adjust'")?.total, 1);
  });

  it('permet à l’administrateur de répondre directement sans proposition', async () => {
    const created = await (await create('student-a', 'rec-a', { ...order, subject: 'Réponse directe' })).json() as ClaimBody;
    assert.equal((await post(`/api/staff/claims/${created.id}/validate`, 'manager-a', {})).status, 409);
    const direct = await post(`/api/staff/claims/${created.id}/validate`, 'admin-a', { decision: 'refuse', response: 'Commande conforme.' });
    assert.equal(direct.status, 200);
    const claim = await direct.json() as ClaimBody;
    assert.equal(claim.status, 'resolved');
    assert.equal(claim.decision, 'refuse');
    assert.equal(claim.response, 'Commande conforme.');
  });
});
