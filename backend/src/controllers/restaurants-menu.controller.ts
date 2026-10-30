import type { Express } from 'express';
import type { Database } from '../db/database.ts';
import { restaurantsMenuService } from '../services/restaurants-menu.service.ts';

export function registerRestaurantsMenuRoutes(app: Express, db: Database, options: { now?: () => Date } = {}): void {
  const service = restaurantsMenuService(db, options);
  app.get('/api/restaurants', (req, res) => {
    const parse = (value: unknown, fallback: number): number => {
      if (value === undefined) return fallback;
      if (typeof value !== 'string' || !/^\d+$/.test(value)) return Number.NaN;
      return Number(value);
    };
    res.json(service.list(parse(req.query.page, 1), parse(req.query.pageSize, 20)));
  });
  app.get('/api/restaurants/:slug', (req, res) => res.json(service.detail(req.params.slug)));
  app.get('/api/restaurants/:slug/menu', (req, res) => res.json(service.menu(req.params.slug)));
  app.get('/api/restaurants/:slug/assets/:id', (req, res) => {
    const asset = service.asset(req.params.slug, req.params.id);
    if (!asset) {
      res.status(404).json({ error: { code: 'ASSET_NOT_FOUND', message: 'Image introuvable.', details: [] } });
      return;
    }
    res.type(asset.mime).set('x-content-type-options', 'nosniff').set('cache-control', 'public, max-age=3600').send(Buffer.from(asset.data));
  });
}
