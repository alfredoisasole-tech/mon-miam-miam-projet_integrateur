import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { seedDemoData } from '../src/seed.ts';
import { demarrer, type Serveur } from './helpers.ts';

/**
 * Parcours complet avec le vrai serveur, de vraies connexions et les données de démonstration :
 * personnalisation du restaurant, inscription avec parrainage, commande, avis, classement,
 * réclamation de points, export et suppression du compte.
 */
describe('[MM-PARCOURS] Parcours complet de bout en bout', () => {
  let db: Database;
  let server: Serveur;
  let clock = new Date('2026-11-04T10:00:00.000Z');
  const tokens: Record<string, string> = {};
  let dishes: Array<{ id: string; priceFc: number }> = [];
  let friendOrderId = '';

  async function call(method: string, path: string, who?: string, body?: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(`${server.base}${path}`, {
      method,
      headers: {
        ...(who ? { authorization: `Bearer ${tokens[who]}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) as Record<string, any> : {} };
  }
  async function login(key: string, identifier: string, password: string) {
    const result = await call('POST', '/api/auth/login', undefined, { identifier, password });
    assert.equal(result.status, 200, `connexion de ${key}`);
    tokens[key] = result.body['token'];
  }

  before(async () => {
    db = new Database(':memory:');
    migrate(db);
    seedDemoData(db, {
      restaurantAdminPassword: 'AdminPass1', employeePassword: 'EmployePass1',
      studentPassword: 'EtudiantPass1', platformAdminPassword: 'PlatformPass1',
    });
    server = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-with-more-than-32-characters' }), {
      database: db, now: () => new Date(clock),
    }));
    await login('admin', 'admin@zeduc-space.test', 'AdminPass1');
    await login('employee', 'employe@monmiam.test', 'EmployePass1');
    await login('student', 'etudiant@monmiam.test', 'EtudiantPass1');
    const menu = await call('GET', '/api/restaurants/zeduc-space/menu');
    dishes = (menu.body['categories'] as Array<{ items: Array<{ id: string; priceFc: number }> }>).flatMap((category) => category.items);
  });
  after(async () => { await server.fermer(); db.close(); });

  it('1. l’administrateur personnalise la charte et le profil public la reflète aussitôt', async () => {
    const patch = await call('PATCH', '/api/admin/settings', 'admin', {
      brand: { primaryColor: '#112233', fontFamily: 'Georgia', defaultMode: 'dark' },
      loyalty: { validityMonths: 6 },
    });
    assert.equal(patch.status, 200);
    const profile = await call('GET', '/api/restaurants/zeduc-space');
    assert.deepEqual(profile.body['colors'], { primary: '#112233', secondary: '#000000' });
    assert.equal(profile.body['fontFamily'], 'Georgia');
    assert.equal(profile.body['defaultMode'], 'dark');
    const other = await call('GET', '/api/restaurants/chez-lea');
    assert.deepEqual(other.body['colors'], { primary: '#cfbd97', secondary: '#000000' }, 'un autre restaurant garde sa charte');
    // On remet la durée de validité par défaut pour la suite.
    assert.equal((await call('PATCH', '/api/admin/settings', 'admin', { loyalty: { validityMonths: 12 } })).status, 200);
  });

  it('2. une charte invalide est refusée et un étudiant ne peut pas la modifier', async () => {
    assert.equal((await call('PATCH', '/api/admin/settings', 'admin', { brand: { primaryColor: 'rouge' } })).status, 400);
    assert.equal((await call('PATCH', '/api/admin/settings', 'student', { brand: { primaryColor: '#000000' } })).status, 403);
  });

  it('3. un ami s’inscrit avec le code de parrainage de l’étudiant, un code inconnu est refusé', async () => {
    const referral = await call('GET', '/api/restaurants/zeduc-space/referral', 'student');
    assert.equal(referral.status, 200);
    const code = referral.body['code'] as string;
    assert.ok(code);
    const form = (email: string, phone: string, referralCode: string) => ({
      name: 'Jean Kabasele', email, phone, password: 'AmiPass1234', confirmPassword: 'AmiPass1234',
      deliveryAddress: '12 avenue de la Paix', commune: 'Limete', quartier: 'Industriel', referralCode, acceptTerms: true,
    });
    const unknown = await call('POST', '/api/restaurants/zeduc-space/auth/register', undefined, form('ami@example.test', '+243820000099', 'INCONNU1234'));
    assert.equal(unknown.status, 422);
    assert.equal(unknown.body['error']['code'], 'INVALID_REFERRAL_CODE');
    const ok = await call('POST', '/api/restaurants/zeduc-space/auth/register', undefined, form('ami@example.test', '+243820000099', code.toLowerCase()));
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    await login('friend', 'ami@example.test', 'AmiPass1234');
    const pending = await call('GET', '/api/restaurants/zeduc-space/referral', 'student');
    assert.equal(pending.body['referees'][0]['status'], 'pending');
    assert.equal(pending.body['referees'][0]['name'], 'Jean K.', 'le nom du filleul est masqué');
  });

  it('4. la première commande de 3 000 FC ou plus du filleul rapporte des points au parrain', async () => {
    const dish = dishes.find((item) => item.priceFc >= 3000)!;
    const created = await call('POST', '/api/orders', 'friend', {
      restaurant: 'zeduc-space', type: 'dine_in', paymentMethod: 'cash', items: [{ menuItemId: dish.id, quantity: 1 }],
    }, { 'idempotency-key': 'parcours-commande-1' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    friendOrderId = created.body['id'];
    for (const status of ['confirmed', 'preparing', 'ready', 'completed']) {
      const step = await call('PATCH', `/api/staff/orders/${friendOrderId}/status`, 'employee', { status });
      assert.equal(step.status, 200, `statut ${status} : ${JSON.stringify(step.body)}`);
    }
    const referral = await call('GET', '/api/restaurants/zeduc-space/referral', 'student');
    assert.equal(referral.body['referees'][0]['status'], 'rewarded');
    assert.ok(referral.body['totals']['pointsEarned'] >= 1);
    const loyalty = await call('GET', '/api/restaurants/zeduc-space/loyalty', 'student');
    assert.equal(loyalty.body['availablePoints'], referral.body['totals']['pointsEarned'], 'le solde du parrain est égal aux points de parrainage');
  });

  it('5. l’ami note sa commande une seule fois', async () => {
    const first = await call('POST', `/api/orders/${friendOrderId}/review`, 'friend', { rating: 5, comment: 'Délicieux' });
    assert.equal(first.status, 201);
    const second = await call('POST', `/api/orders/${friendOrderId}/review`, 'friend', { rating: 3 });
    assert.equal(second.status, 409);
    const detail = await call('GET', `/api/orders/${friendOrderId}`, 'friend');
    assert.equal(detail.body['rating'], 5);
  });

  it('6. le top 10 classe l’ami avec un nom masqué et le repère pour lui-même', async () => {
    const top = await call('GET', '/api/restaurants/zeduc-space/top-clients?period=month', 'friend');
    assert.equal(top.status, 200);
    const me = (top.body['items'] as Array<{ name: string; isMe: boolean; orders: number }>).find((item) => item.isMe);
    assert.ok(me);
    assert.equal(me.name, 'Jean K.');
    assert.equal(me.orders, 1);
  });

  it('7. réclamation de points : l’employé propose mais ne peut pas valider, l’administrateur accorde', async () => {
    const claim = await call('POST', '/api/claims', 'student', {
      restaurant: 'zeduc-space', kind: 'points', subject: 'Points manquants',
      message: 'Il manque des points sur ma dernière commande.', requestedPoints: 2,
    });
    assert.equal(claim.status, 201, JSON.stringify(claim.body));
    const id = claim.body['id'];
    const before = (await call('GET', '/api/restaurants/zeduc-space/loyalty', 'student')).body['availablePoints'] as number;
    const proposed = await call('POST', `/api/staff/claims/${id}/propose`, 'employee', { decision: 'accept', response: 'Points ajoutés, merci.' });
    assert.equal(proposed.status, 200);
    assert.equal((await call('POST', `/api/staff/claims/${id}/validate`, 'employee', { pointsGranted: 2 })).status, 403);
    const validated = await call('POST', `/api/staff/claims/${id}/validate`, 'admin', { pointsGranted: 2 });
    assert.equal(validated.status, 200, JSON.stringify(validated.body));
    const after = await call('GET', '/api/restaurants/zeduc-space/loyalty', 'student');
    assert.equal(after.body['availablePoints'], before + 2, 'les 2 points accordés sont crédités');
    const mine = await call('GET', `/api/claims/${id}`, 'student');
    assert.equal(mine.body['status'], 'traitée');
  });

  it('8. l’isolation tient : l’ami ne voit pas la réclamation d’un autre', async () => {
    const list = await call('GET', '/api/claims', 'friend');
    assert.deepEqual(list.body, []);
  });

  it('9. l’ami exporte ses données puis supprime son compte, qui est anonymisé', async () => {
    const friendId = (await call('GET', '/api/me', 'friend')).body['id'] as string;
    const exported = await call('GET', '/api/me/export', 'friend');
    assert.equal(exported.status, 200);
    assert.ok(!JSON.stringify(exported.body).includes('AmiPass1234'));
    const wrong = await call('DELETE', '/api/me', 'friend', { password: 'MauvaisPass1' });
    assert.equal(wrong.status, 401);
    const deleted = await call('DELETE', '/api/me', 'friend', { password: 'AmiPass1234' });
    assert.equal(deleted.status, 200);
    const row = db.get<{ name: string; email: string; phone: string; status: string }>('SELECT name, email, phone, status FROM users WHERE id = ?', [friendId]);
    assert.ok(row);
    assert.equal(row.status, 'deleted');
    assert.ok(!`${row.name}${row.email}${row.phone}`.includes('Jean') && !row.email.includes('ami@example.test') && row.phone !== '+243820000099', 'données personnelles effacées');
    assert.equal(db.get<{ total: number }>('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [friendId])?.total, 1, 'la commande reste pour la comptabilité');
    const reuse = await call('GET', '/api/me', 'friend');
    assert.equal(reuse.status, 401, 'l’ancien jeton ne fonctionne plus');
    const topAfter = await call('GET', '/api/restaurants/zeduc-space/top-clients?period=month', 'student');
    assert.ok(!(topAfter.body['items'] as Array<{ name: string }>).some((item) => item.name === 'Jean K.'));
  });

  it('10. le mot de passe oublié : le code est refusé s’il est faux et le changement de mot de passe invalide l’ancien jeton', async () => {
    const wrong = await call('POST', '/api/auth/reset-password', undefined, { identifier: 'etudiant@monmiam.test', code: 'ZZZZZZZZ', newPassword: 'NouveauPass1' });
    assert.ok(wrong.status >= 400 && wrong.status < 500);
    const changed = await call('POST', '/api/auth/change-password', 'student', { currentPassword: 'EtudiantPass1', newPassword: 'NouveauPass1' });
    assert.equal(changed.status, 200);
    assert.equal((await call('GET', '/api/me', 'student')).status, 401, 'l’ancien jeton est invalide');
    tokens['student'] = changed.body['token'];
    assert.equal((await call('GET', '/api/me', 'student')).status, 200);
  });
});
