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
  ['student-a', { id: 'student-a', role: 'student' }],
  ['student-b', { id: 'student-b', role: 'student' }],
  ['employee-a', { id: 'employee-a', role: 'employee', restaurantId: 'restaurant-a' }],
  ['manager-a', { id: 'manager-a', role: 'manager', restaurantId: 'restaurant-a' }],
  ['admin-a', { id: 'admin-a', role: 'admin', restaurantId: 'restaurant-a' }],
  ['employee-b', { id: 'employee-b', role: 'employee', restaurantId: 'restaurant-b' }],
  ['manager-b', { id: 'manager-b', role: 'manager', restaurantId: 'restaurant-b' }],
  ['admin-b', { id: 'admin-b', role: 'admin', restaurantId: 'restaurant-b' }],
]);

describe('API des réclamations — contrôle du propriétaire et du restaurant', () => {
  let db: Database;
  let server: Serveur;

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    db.run(`INSERT INTO restaurants (id, slug, name, font_family, created_at) VALUES
      ('restaurant-a', 'claims-a', 'Restaurant A', 'Arial', ?),
      ('restaurant-b', 'claims-b', 'Restaurant B', 'Arial', ?)`, [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO restaurant_settings (restaurant_id, opening_hours, updated_at) VALUES
      ('restaurant-a', '{}', ?), ('restaurant-b', '{}', ?)`, [NOW.toISOString(), NOW.toISOString()]);
    db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, created_at) VALUES
      ('student-a', 'restaurant-a', 'student', 'Étudiant A', 'student-a@example.test', '+243810000001', 'hash', ?),
      ('student-b', 'restaurant-b', 'student', 'Étudiant B', 'student-b@example.test', '+243810000002', 'hash', ?),
      ('employee-a', 'restaurant-a', 'employee', 'Employé A', 'employee-a@example.test', '+243810000003', 'hash', ?),
      ('manager-a', 'restaurant-a', 'manager', 'Gérant A', 'manager-a@example.test', '+243810000004', 'hash', ?),
      ('admin-a', 'restaurant-a', 'admin', 'Admin A', 'admin-a@example.test', '+243810000005', 'hash', ?),
      ('employee-b', 'restaurant-b', 'employee', 'Employé B', 'employee-b@example.test', '+243810000006', 'hash', ?),
      ('manager-b', 'restaurant-b', 'manager', 'Gérant B', 'manager-b@example.test', '+243810000007', 'hash', ?),
      ('admin-b', 'restaurant-b', 'admin', 'Admin B', 'admin-b@example.test', '+243810000008', 'hash', ?)`,
    Array.from({ length: 8 }, () => NOW.toISOString()));
    db.run(`INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES
      ('student-a', 'restaurant-a', ?), ('student-b', 'restaurant-b', ?)`, [NOW.toISOString(), NOW.toISOString()]);
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' }), {
      database: db,
      now: () => new Date(NOW),
      resolveToken: (token) => TOKENS.get(token) ?? null,
    }));
  });

  after(async () => { await server.fermer(); db.close(); });

  function headers(token: string): HeadersInit {
    return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  }

  async function createClaim(token: string, restaurant: string, kind = 'other', requestedPoints?: number) {
    return fetch(`${server.base}/api/claims`, {
      method: 'POST', headers: headers(token),
      body: JSON.stringify({
        restaurant, kind, subject: 'Problème sur ma commande',
        message: 'Je souhaite obtenir une vérification de cette situation.',
        ...(requestedPoints === undefined ? {} : { requestedPoints }),
      }),
    });
  }

  it('ne crée que pour une adhésion autorisée et limite les étudiants à leurs propres réclamations', async () => {
    const wrongRestaurant = await createClaim('student-a', 'claims-b');
    assert.equal(wrongRestaurant.status, 404);

    const forgedRestaurantId = await fetch(`${server.base}/api/claims`, {
      method: 'POST', headers: headers('student-a'),
      body: JSON.stringify({
        restaurant: 'claims-a', restaurantId: 'restaurant-b', kind: 'other',
        subject: 'Problème sur ma commande', message: 'Je souhaite obtenir une vérification.',
      }),
    });
    assert.equal(forgedRestaurantId.status, 400);

    const ownResponse = await createClaim('student-a', 'claims-a');
    const otherResponse = await createClaim('student-b', 'claims-b');
    assert.equal(ownResponse.status, 201);
    assert.equal(otherResponse.status, 201);
    const own = await ownResponse.json() as { id: string; status: string; [key: string]: unknown };
    const other = await otherResponse.json() as { id: string };
    assert.equal(own.status, 'ouverte');
    assert.equal('proposedResponse' in own, false);

    const list = await fetch(`${server.base}/api/claims`, { headers: headers('student-a') });
    assert.equal(list.status, 200);
    const claims = await list.json() as Array<{ id: string }>;
    assert.deepEqual(claims.map((claim) => claim.id), [own.id]);
    assert.equal((await fetch(`${server.base}/api/claims/${other.id}`, { headers: headers('student-a') })).status, 404);
  });

  it('filtre les listes et bloque lecture ou modification directe depuis un autre restaurant', async () => {
    const claimBResponse = await createClaim('student-b', 'claims-b');
    assert.equal(claimBResponse.status, 201);
    const claimB = await claimBResponse.json() as { id: string };
    const claimAResponse = await createClaim('student-a', 'claims-a');
    const claimA = await claimAResponse.json() as { id: string };

    const listA = await fetch(`${server.base}/api/staff/claims?restaurantId=restaurant-b`, {
      headers: headers('employee-a'),
    });
    assert.equal(listA.status, 200);
    const claimsA = await listA.json() as Array<{ id: string; restaurant: { slug: string } }>;
    assert.ok(claimsA.some((claim) => claim.id === claimA.id));
    assert.ok(claimsA.every((claim) => claim.id !== claimB.id && claim.restaurant.slug === 'claims-a'));
    assert.equal((await fetch(`${server.base}/api/staff/claims/${claimA.id}`, { headers: headers('employee-b') })).status, 404);

    const crossRestaurantProposal = await fetch(`${server.base}/api/staff/claims/${claimA.id}/propose`, {
      method: 'POST', headers: headers('employee-b'),
      body: JSON.stringify({ decision: 'accept', response: 'Réponse suffisamment détaillée.' }),
    });
    assert.equal(crossRestaurantProposal.status, 404);
    assert.equal(db.get<{ status: string }>('SELECT status FROM claims WHERE id = ?', [claimA.id])?.status, 'open');

    const proposalB = await fetch(`${server.base}/api/staff/claims/${claimB.id}/propose`, {
      method: 'POST', headers: headers('employee-b'),
      body: JSON.stringify({ decision: 'accept', response: 'Réponse suffisamment détaillée.' }),
    });
    assert.equal(proposalB.status, 200);
    assert.equal((await fetch(`${server.base}/api/staff/claims/${claimB.id}/validate`, {
      method: 'POST', headers: headers('employee-b'), body: JSON.stringify({}),
    })).status, 403);
    assert.equal((await fetch(`${server.base}/api/staff/claims/${claimB.id}/validate`, {
      method: 'POST', headers: headers('manager-a'), body: JSON.stringify({}),
    })).status, 404);

    const validateB = await fetch(`${server.base}/api/staff/claims/${claimB.id}/validate`, {
      method: 'POST', headers: headers('manager-b'), body: JSON.stringify({}),
    });
    assert.equal(validateB.status, 200);
    const studentBView = await fetch(`${server.base}/api/claims/${claimB.id}`, { headers: headers('student-b') });
    const resolved = await studentBView.json() as { status: string; decision: string; response: string };
    assert.equal(resolved.status, 'traitée');
    assert.equal(resolved.decision, 'accept');
    assert.equal(resolved.response, 'Réponse suffisamment détaillée.');
  });

  it('crédite au plus les points demandés une seule fois et limite le rejet au restaurant autorisé', async () => {
    const claimResponse = await createClaim('student-a', 'claims-a', 'points', 10);
    assert.equal(claimResponse.status, 201);
    const claim = await claimResponse.json() as { id: string };
    const proposal = await fetch(`${server.base}/api/staff/claims/${claim.id}/propose`, {
      method: 'POST', headers: headers('employee-a'),
      body: JSON.stringify({ decision: 'accept', response: 'Nous validons votre demande de points.' }),
    });
    assert.equal(proposal.status, 200);
    assert.equal((await fetch(`${server.base}/api/staff/claims/${claim.id}/validate`, {
      method: 'POST', headers: headers('manager-a'), body: JSON.stringify({ pointsGranted: 8 }),
    })).status, 403);
    assert.equal((await fetch(`${server.base}/api/staff/claims/${claim.id}/validate`, {
      method: 'POST', headers: headers('admin-b'), body: JSON.stringify({ pointsGranted: 8 }),
    })).status, 404);
    assert.equal((await fetch(`${server.base}/api/staff/claims/${claim.id}/validate`, {
      method: 'POST', headers: headers('admin-a'), body: JSON.stringify({ pointsGranted: 11 }),
    })).status, 400);

    const validate = await fetch(`${server.base}/api/staff/claims/${claim.id}/validate`, {
      method: 'POST', headers: headers('admin-a'), body: JSON.stringify({ pointsGranted: 8 }),
    });
    assert.equal(validate.status, 200);
    assert.equal(db.get<{ total: number }>(
      "SELECT COUNT(*) AS total FROM points_ledger WHERE user_id = 'student-a' AND restaurant_id = 'restaurant-a' AND kind = 'adjust'",
    )?.total, 1);
    assert.equal(db.get<{ points: number }>(
      "SELECT points FROM points_ledger WHERE user_id = 'student-a' AND restaurant_id = 'restaurant-a' AND kind = 'adjust'",
    )?.points, 8);
    assert.equal((await fetch(`${server.base}/api/staff/claims/${claim.id}/validate`, {
      method: 'POST', headers: headers('admin-a'), body: JSON.stringify({ pointsGranted: 8 }),
    })).status, 409);

    const rejectClaim = await createClaim('student-a', 'claims-a');
    const rejectId = (await rejectClaim.json() as { id: string }).id;
    await fetch(`${server.base}/api/staff/claims/${rejectId}/propose`, {
      method: 'POST', headers: headers('employee-a'),
      body: JSON.stringify({ decision: 'refuse', response: 'Réponse initiale à faire vérifier.' }),
    });
    assert.equal((await fetch(`${server.base}/api/staff/claims/${rejectId}/reject`, {
      method: 'POST', headers: headers('manager-b'), body: JSON.stringify({ note: 'Veuillez préciser les éléments.' }),
    })).status, 404);
    const rejected = await fetch(`${server.base}/api/staff/claims/${rejectId}/reject`, {
      method: 'POST', headers: headers('manager-a'), body: JSON.stringify({ note: 'Veuillez préciser les éléments.' }),
    });
    assert.equal(rejected.status, 200);
    const rejectedBody = await rejected.json() as { status: string; managerNote: string };
    assert.equal(rejectedBody.status, 'open');
    assert.equal(rejectedBody.managerNote, 'Veuillez préciser les éléments.');
  });
});
