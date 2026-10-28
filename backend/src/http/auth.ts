import type { RequestHandler } from 'express';
import { AppError } from './errors.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';

export type TokenResolver = (token: string) => AuthenticatedUser | null | Promise<AuthenticatedUser | null>;

/** Adapte le jeton à la source de connexion retenue par l'application. */
export function createAuthMiddleware(resolveToken: TokenResolver): RequestHandler {
  return (req, res, next) => {
    const match = req.header('authorization')?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) {
      next(new AppError(401, 'UNAUTHORIZED', 'Vous devez vous connecter pour continuer.'));
      return;
    }

    Promise.resolve(resolveToken(match[1]!)).then((user) => {
      if (!user) {
        next(new AppError(401, 'UNAUTHORIZED', 'Votre jeton de connexion est invalide.'));
        return;
      }
      res.locals['authenticatedUser'] = user;
      next();
    }).catch(next);
  };
}
