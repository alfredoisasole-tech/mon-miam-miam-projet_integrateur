import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signJwt, verifyJwt } from '../../src/domain/jwt.ts';

describe('Domaine JWT (jetons signés HS256 et timingSafeEqual)', () => {
  const SECRET = 'une-cle-secrete-de-test-super-longue-et-robuste-12345';
  const PAYLOAD = { sub: 'usr_123', role: 'student', restaurantId: 'rst_abc' };
  type TestPayload = typeof PAYLOAD & { exp?: number };

  it('génère et vérifie un jeton JWT valide', () => {
    const token = signJwt(PAYLOAD, SECRET, 3600);
    const verified = verifyJwt<TestPayload>(token, SECRET);

    assert.ok(verified);
    assert.equal(verified?.sub, 'usr_123');
    assert.equal(verified?.role, 'student');
    assert.equal(verified?.restaurantId, 'rst_abc');
    assert.ok(typeof verified?.exp === 'number');
  });

  it('refuse un jeton altéré ou dont la signature est faussée', () => {
    const token = signJwt(PAYLOAD, SECRET, 3600);
    const parts = token.split('.');
    const falsified = `${parts[0]}.${parts[1]}.signature_fausse`;
    assert.equal(verifyJwt(falsified, SECRET), null);

    // Altération du corps
    const tamperedPayload = Buffer.from(JSON.stringify({ ...PAYLOAD, role: 'admin' })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    assert.equal(verifyJwt(tamperedToken, SECRET), null);
  });

  it('refuse un jeton expiré', () => {
    const now = 1700000000;
    // Jeton valide 60 secondes créé au timestamp `now`
    const token = signJwt(PAYLOAD, SECRET, 60, now);

    // Test avant expiration
    assert.ok(verifyJwt(token, SECRET, now + 30));

    // Test après expiration
    assert.equal(verifyJwt(token, SECRET, now + 120), null);
  });

  it('refuse un jeton signé avec un secret différent', () => {
    const token = signJwt(PAYLOAD, SECRET, 3600);
    const otherSecret = 'un-autre-secret-totalement-different-1234567890';
    assert.equal(verifyJwt(token, otherSecret), null);
  });

  it('refuse les formats invalides ou vides', () => {
    assert.equal(verifyJwt('', SECRET), null);
    assert.equal(verifyJwt('un-seul-segment', SECRET), null);
    assert.equal(verifyJwt('deux.segments.trois.quatre', SECRET), null);
  });
});
