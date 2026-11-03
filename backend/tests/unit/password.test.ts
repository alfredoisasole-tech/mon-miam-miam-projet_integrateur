import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, isPasswordStrong } from '../../src/domain/password.ts';

describe('Domaine Password (hachage et vérification scrypt)', () => {
  it('ne stocke jamais un mot de passe en clair et génère un hachage scrypt préfixé', () => {
    const raw = 'Secret123!';
    const hash = hashPassword(raw);
    assert.notEqual(hash, raw);
    assert.match(hash, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  });

  it('produit deux empreintes distinctes pour le même mot de passe grâce au sel aléatoire', () => {
    const raw = 'SuperMotDePasse2026';
    const hash1 = hashPassword(raw);
    const hash2 = hashPassword(raw);
    assert.notEqual(hash1, hash2);
    assert.equal(verifyPassword(raw, hash1), true);
    assert.equal(verifyPassword(raw, hash2), true);
  });

  it('valide le bon mot de passe et rejette un mot de passe incorrect', () => {
    const hash = hashPassword('Azerty123');
    assert.equal(verifyPassword('Azerty123', hash), true);
    assert.equal(verifyPassword('MauvaisMotDePasse', hash), false);
    assert.equal(verifyPassword('azerty123', hash), false);
  });

  it('rejette un format de hachage corrompu ou falsifié sans planter', () => {
    assert.equal(verifyPassword('Secret123', 'invalid-hash'), false);
    assert.equal(verifyPassword('Secret123', 'md5$invalid$salt'), false);
    assert.equal(verifyPassword('Secret123', ''), false);
  });

  it('valide la robustesse du mot de passe (au moins 8 caractères, une majuscule et un chiffre)', () => {
    assert.equal(isPasswordStrong('Valide123'), true);
    assert.equal(isPasswordStrong('Court1A'), false); // 7 caractères
    assert.equal(isPasswordStrong('sanschiffreA'), false);
    assert.equal(isPasswordStrong('sansmajuscule123'), false);
    assert.equal(isPasswordStrong('ToutEnMajuscule123'), true);
  });
});
