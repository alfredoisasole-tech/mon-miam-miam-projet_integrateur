import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { demarrer, type Serveur } from './helpers.ts';

describe('Route de santé', () => {
  let serveur: Serveur;
  before(async () => {
    serveur = await demarrer(createApp(loadConfig({ NODE_ENV: 'test' })));
  });
  after(() => serveur.fermer());

  it('répond 200 avec { status: "ok" } et la date du serveur', async () => {
    const res = await fetch(`${serveur.base}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; time: string };
    assert.equal(body.status, 'ok');
    assert.ok(!Number.isNaN(Date.parse(body.time)), 'la date doit être au format ISO 8601');
  });

  it('envoie les en-têtes de sécurité', async () => {
    const res = await fetch(`${serveur.base}/api/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(res.headers.get('x-powered-by'), null, 'ne pas annoncer la technologie du serveur');
  });
});

describe('CORS', () => {
  let serveur: Serveur;
  before(async () => {
    serveur = await demarrer(createApp(loadConfig({ NODE_ENV: 'test', CORS_ORIGINS: 'http://localhost:5173' })));
  });
  after(() => serveur.fermer());

  it("autorise l'adresse du site configurée", async () => {
    const res = await fetch(`${serveur.base}/api/health`, { headers: { origin: 'http://localhost:5173' } });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });

  it('ne donne aucune autorisation à une autre adresse', async () => {
    const res = await fetch(`${serveur.base}/api/health`, { headers: { origin: 'http://autre-site.exemple' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  it('répond 204 à une requête de pré-vérification', async () => {
    const res = await fetch(`${serveur.base}/api/health`, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'POST' },
    });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('access-control-allow-methods') ?? '', /POST/);
  });
});
