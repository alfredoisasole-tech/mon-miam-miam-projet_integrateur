import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { ConfigError, EXAMPLE_JWT_SECRET, EXAMPLE_PAYMENT_WEBHOOK_SECRET, loadConfig } from '../src/config.ts';

const SECRET_SOLIDE = randomBytes(32).toString('hex');

describe('Configuration', () => {
  it('applique des valeurs par défaut en développement', () => {
    const config = loadConfig({});
    assert.equal(config.env, 'development');
    assert.equal(config.port, 3000);
    assert.equal(config.databasePath, './data/mon-miam-miam.sqlite');
    assert.deepEqual(config.corsOrigins, ['http://localhost:5173']);
    assert.ok(config.jwtSecret.length >= 32);
    assert.match(config.paymentWebhookSecret, /non-secr[eè]te/i);
  });

  it('lit le port, le chemin de la base et la liste des adresses autorisées', () => {
    const config = loadConfig({ PORT: '4010', DATABASE_PATH: '/var/data/a.sqlite', CORS_ORIGINS: 'https://a.exemple, https://b.exemple' });
    assert.equal(config.port, 4010);
    assert.equal(config.databasePath, '/var/data/a.sqlite');
    assert.deepEqual(config.corsOrigins, ['https://a.exemple', 'https://b.exemple']);
  });

  it('refuse un port invalide, avec un message en français', () => {
    assert.throws(() => loadConfig({ PORT: 'abc' }), (e: unknown) => e instanceof ConfigError && /PORT/.test(e.message));
  });

  describe('en production', () => {
    it('refuse de démarrer sans JWT_SECRET', () => {
      assert.throws(() => loadConfig({ NODE_ENV: 'production' }), (e: unknown) => e instanceof ConfigError && /JWT_SECRET/.test(e.message));
    });

    it('refuse de démarrer sans PAYMENT_WEBHOOK_SECRET', () => {
      assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: SECRET_SOLIDE }),
        (e: unknown) => e instanceof ConfigError && /PAYMENT_WEBHOOK_SECRET/.test(e.message));
    });

    it('refuse un PAYMENT_WEBHOOK_SECRET trop court', () => {
      assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: SECRET_SOLIDE, PAYMENT_WEBHOOK_SECRET: randomBytes(8).toString('hex') }), ConfigError);
    });

    it('refuse la valeur non secrète du fichier exemple en production', () => {
      assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: SECRET_SOLIDE, PAYMENT_WEBHOOK_SECRET: EXAMPLE_PAYMENT_WEBHOOK_SECRET }), ConfigError);
    });

    it('refuse un JWT_SECRET de moins de 32 caractères', () => {
      assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'trop-court' }), ConfigError);
    });

    it("refuse la valeur d'exemple du JWT_SECRET", () => {
      assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: EXAMPLE_JWT_SECRET }), ConfigError);
    });

    it("refuse un secret qui reprend la valeur d'exemple, même rallongée", () => {
      assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: `${EXAMPLE_JWT_SECRET}-suite-ajoutee` }), ConfigError);
      assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'Changez-Moi-0123456789abcdef0123456789abcdef' }), ConfigError);
    });

    it('accepte un secret solide', () => {
      const paymentSecret = randomBytes(32).toString('hex');
      const config = loadConfig({ NODE_ENV: 'production', JWT_SECRET: SECRET_SOLIDE, PAYMENT_WEBHOOK_SECRET: paymentSecret });
      assert.equal(config.env, 'production');
      assert.equal(config.jwtSecret, SECRET_SOLIDE);
      assert.equal(config.paymentWebhookSecret, paymentSecret);
    });
  });
});
