import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { AppError } from '../src/http/errors.ts';
import { demarrer, type Serveur } from './helpers.ts';

interface ReponseErreur {
  error: { code: string; message: string; details: unknown[] };
}

describe("Format des erreurs de l'API", () => {
  let serveur: Serveur;
  before(async () => {
    const app = createApp(loadConfig({ NODE_ENV: 'test' }), {
      routes: (a) => {
        a.get('/api/test/regle', () => {
          throw new AppError(422, 'REGLE_METIER', 'Cette action est refusée.', [{ field: 'quantity', message: 'Trop élevée.' }]);
        });
        a.get('/api/test/bug', () => {
          throw new Error('détail technique secret');
        });
        a.post('/api/test/echo', (req, res) => {
          res.json(req.body);
        });
      },
    });
    serveur = await demarrer(app);
  });
  after(() => serveur.fermer());

  it('renvoie 404 au format JSON pour une route inconnue', async () => {
    const res = await fetch(`${serveur.base}/api/inconnue`);
    assert.equal(res.status, 404);
    const body = (await res.json()) as ReponseErreur;
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(body.error.message, 'Route introuvable.');
  });

  it('renvoie le statut, le code, le message et les détails d\'une erreur métier', async () => {
    const res = await fetch(`${serveur.base}/api/test/regle`);
    assert.equal(res.status, 422);
    const body = (await res.json()) as ReponseErreur;
    assert.equal(body.error.code, 'REGLE_METIER');
    assert.equal(body.error.message, 'Cette action est refusée.');
    assert.deepEqual(body.error.details, [{ field: 'quantity', message: 'Trop élevée.' }]);
  });

  it("renvoie un simple 500 sans détail technique pour une erreur inattendue", async () => {
    const res = await fetch(`${serveur.base}/api/test/bug`);
    assert.equal(res.status, 500);
    const texte = await res.text();
    assert.ok(!texte.includes('détail technique secret'), 'le détail ne doit jamais être montré');
    const body = JSON.parse(texte) as ReponseErreur;
    assert.equal(body.error.code, 'INTERNAL_ERROR');
    assert.equal(body.error.message, 'Une erreur interne est survenue.');
  });

  it('renvoie 400 VALIDATION_ERROR quand le corps de la requête est du JSON invalide', async () => {
    const res = await fetch(`${serveur.base}/api/test/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{pas du json',
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as ReponseErreur;
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  });

  it('accepte et relit un corps JSON valide', async () => {
    const res = await fetch(`${serveur.base}/api/test/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nom: 'Marie' }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { nom: 'Marie' });
  });
});
