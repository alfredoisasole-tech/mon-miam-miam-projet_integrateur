import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from './errors.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';

export type UserRole = 'student' | 'employee' | 'manager' | 'admin' | 'platform_admin';

/**
 * Gardes d'accès basés sur l'authentification et les permissions (Jira 7.1 / Fiche D-7).
 * Règle : Les rôles et droits proviennent TOUJOURS du jeton vérifié (res.locals),
 * JAMAIS du corps ou des paramètres de la requête.
 */
export const authGuards = {
  /**
   * Vérifie que l'utilisateur est authentifié.
   * Réfuse (401) si aucun jeton valide n'a été fourni.
   */
  required: (req: Request, res: Response, next: NextFunction): void => {
    const user = res.locals['authenticatedUser'] as AuthenticatedUser | undefined;
    if (!user || !user.id) {
      next(new AppError(401, 'UNAUTHORIZED', 'Vous devez vous connecter pour continuer.'));
      return;
    }
    if (user.status && user.status !== 'active') {
      next(new AppError(403, 'ACCOUNT_DISABLED', 'Ce compte est désactivé.'));
      return;
    }
    next();
  },

  /**
   * Vérifie que l'utilisateur connecté possède l'un des rôles requis.
   * Refuse (401) si non connecté, ou (403) si le rôle ne correspond pas.
   */
  role: (...allowedRoles: UserRole[]): RequestHandler => {
    const allowed = new Set<string>(allowedRoles);
    return (_req: Request, res: Response, next: NextFunction): void => {
      const user = res.locals['authenticatedUser'] as AuthenticatedUser | undefined;
      if (!user || !user.id) {
        next(new AppError(401, 'UNAUTHORIZED', 'Vous devez vous connecter pour continuer.'));
        return;
      }
      if (user.status && user.status !== 'active') {
        next(new AppError(403, 'ACCOUNT_DISABLED', 'Ce compte est désactivé.'));
        return;
      }
      if (!allowed.has(user.role)) {
        next(new AppError(403, 'FORBIDDEN', 'Vous n’avez pas les droits nécessaires pour effectuer cette action.'));
        return;
      }
      next();
    };
  },

  /**
   * Vérifie que l'utilisateur est un membre du personnel rattaché à un restaurant.
   */
  staffOnly: (_req: Request, res: Response, next: NextFunction): void => {
    const user = res.locals['authenticatedUser'] as AuthenticatedUser | undefined;
    if (!user || !user.id) {
      next(new AppError(401, 'UNAUTHORIZED', 'Vous devez vous connecter pour continuer.'));
      return;
    }
    const staffRoles = new Set(['employee', 'manager', 'admin']);
    if (!staffRoles.has(user.role) || !user.restaurantId) {
      next(new AppError(403, 'FORBIDDEN', 'Cette action est réservée au personnel d’un restaurant.'));
      return;
    }
    next();
  },
};
