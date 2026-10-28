import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Express } from 'express';

export interface Serveur {
  base: string;
  fermer(): Promise<void>;
}

/** Démarre l'application sur un port libre, pour tester avec de vraies requêtes HTTP. */
export async function demarrer(app: Express): Promise<Serveur> {
  const server: Server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    fermer: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
