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

describe('Configuration du fournisseur de paiement', () => {
  const EASYPAY = {
    PAYMENT_PROVIDER: 'easypay',
    EASYPAY_CID: 'cid-de-test',
    EASYPAY_TOKEN: 'jeton-de-test',
    EASYPAY_IPN_KEY: randomBytes(32).toString('hex'),
    SITE_URL: 'https://site.exemple',
  };

  it('utilise la simulation par défaut, sans configuration Easypay', () => {
    const config = loadConfig({});
    assert.equal(config.paymentProvider, 'simulation');
    assert.equal(config.easypay, null);
  });

  it('accepte Easypay avec sa configuration complète et le bac à sable par défaut', () => {
    const config = loadConfig(EASYPAY);
    assert.equal(config.paymentProvider, 'easypay');
    assert.deepEqual(config.easypay, {
      mode: 'sandbox', cid: 'cid-de-test', token: 'jeton-de-test', ipnKey: EASYPAY.EASYPAY_IPN_KEY, siteUrl: 'https://site.exemple',
    });
  });

  it('accepte le mode production v1 et retire le « / » final de l’adresse du site', () => {
    const config = loadConfig({ ...EASYPAY, EASYPAY_MODE: 'v1', SITE_URL: 'https://site.exemple/' });
    assert.equal(config.easypay?.mode, 'v1');
    assert.equal(config.easypay?.siteUrl, 'https://site.exemple');
  });

  it('refuse un fournisseur inconnu', () => {
    assert.throws(() => loadConfig({ PAYMENT_PROVIDER: 'autre' }), (e: unknown) => e instanceof ConfigError && /PAYMENT_PROVIDER/.test(e.message));
  });

  for (const variable of ['EASYPAY_CID', 'EASYPAY_TOKEN', 'EASYPAY_IPN_KEY', 'SITE_URL'] as const) {
    it(`refuse Easypay sans ${variable}, en nommant la variable`, () => {
      const env: Record<string, string> = { ...EASYPAY };
      delete env[variable];
      assert.throws(() => loadConfig(env), (e: unknown) => e instanceof ConfigError && e.message.includes(variable));
    });
  }

  it('refuse un mode Easypay inconnu', () => {
    assert.throws(() => loadConfig({ ...EASYPAY, EASYPAY_MODE: 'test' }), (e: unknown) => e instanceof ConfigError && /EASYPAY_MODE/.test(e.message));
  });

  it('refuse une clé de notification trop courte', () => {
    assert.throws(() => loadConfig({ ...EASYPAY, EASYPAY_IPN_KEY: 'courte' }), (e: unknown) => e instanceof ConfigError && /EASYPAY_IPN_KEY/.test(e.message));
  });

  it('refuse une adresse de site invalide', () => {
    assert.throws(() => loadConfig({ ...EASYPAY, SITE_URL: 'pas-une-adresse' }), (e: unknown) => e instanceof ConfigError && /SITE_URL/.test(e.message));
  });

  it('exige une adresse de site en https en production', () => {
    const production = { NODE_ENV: 'production', JWT_SECRET: SECRET_SOLIDE, PAYMENT_WEBHOOK_SECRET: randomBytes(32).toString('hex') };
    assert.throws(() => loadConfig({ ...production, ...EASYPAY, SITE_URL: 'http://site.exemple' }), (e: unknown) => e instanceof ConfigError && /SITE_URL/.test(e.message));
    assert.equal(loadConfig({ ...production, ...EASYPAY }).paymentProvider, 'easypay');
  });

  it('n’écrit jamais les identifiants dans un message d’erreur', () => {
    try {
      loadConfig({ ...EASYPAY, EASYPAY_MODE: 'test' });
      assert.fail('une erreur était attendue');
    } catch (error) {
      assert.ok(error instanceof ConfigError);
      for (const secret of [EASYPAY.EASYPAY_CID, EASYPAY.EASYPAY_TOKEN, EASYPAY.EASYPAY_IPN_KEY]) assert.equal(error.message.includes(secret), false);
    }
  });
});
