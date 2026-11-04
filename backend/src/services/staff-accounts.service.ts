import { randomBytes, randomUUID } from 'node:crypto';
import type { Database } from '../db/database.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';
import { normalizePhone } from '../domain/phone.ts';
import { AppError } from '../http/errors.ts';
import { hashPassword } from './auth.service.ts';

interface StaffAccountRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'employee' | 'manager' | 'admin';
  status: string;
  must_change_password: number;
  created_at: string;
}

function temporaryPassword(): string {
  return `Mm${randomBytes(18).toString('base64url')}7`;
}

function staffOutput(account: StaffAccountRow) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    role: account.role,
    status: account.status,
    mustChangePassword: account.must_change_password === 1,
    createdAt: account.created_at,
  };
}

export class StaffAccountsService {
  private readonly db: Database;
  private readonly now: () => Date;

  constructor(db: Database, now: () => Date = () => new Date()) {
    this.db = db;
    this.now = now;
  }

  list(user: AuthenticatedUser & { restaurantId: string }) {
    return this.db.all<StaffAccountRow>(
      `SELECT id, name, email, phone, role, status, must_change_password, created_at
       FROM users WHERE restaurant_id = ? AND role IN ('employee', 'manager', 'admin')
       ORDER BY role, name COLLATE NOCASE, id`, [user.restaurantId],
    ).map(staffOutput);
  }

  create(user: AuthenticatedUser & { restaurantId: string }, input: unknown) {
    const body = input as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['name', 'email', 'phone', 'role'].includes(key))) {
      throw new AppError(400, 'INVALID_BODY', 'Les champs du compte du personnel sont invalides.');
    }
    const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
    const email = typeof body['email'] === 'string' ? body['email'].trim().toLowerCase() : '';
    const phone = normalizePhone(body['phone']);
    const role = body['role'];
    if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone
      || (role !== 'employee' && role !== 'manager') || (role === 'manager' && user.role !== 'admin')) {
      throw new AppError(400, 'INVALID_BODY', 'Nom, e-mail, téléphone ou rôle invalide pour cet administrateur.');
    }
    const duplicate = () => this.db.get('SELECT id FROM users WHERE lower(email) = lower(?) OR phone = ?', [email, phone])
      || this.db.get('SELECT id FROM platform_admins WHERE lower(email) = lower(?)', [email]);
    if (duplicate()) throw new AppError(409, 'ACCOUNT_TAKEN', 'Un compte existe déjà avec cet e-mail ou ce téléphone.');

    const id = `usr_${randomUUID()}`;
    const password = temporaryPassword();
    const passwordHash = hashPassword(password);
    const createdAt = this.now().toISOString();
    this.db.transaction(() => {
      if (duplicate()) throw new AppError(409, 'ACCOUNT_TAKEN', 'Un compte existe déjà avec cet e-mail ou ce téléphone.');
      this.db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, must_change_password, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, user.restaurantId, role, name, email, phone, passwordHash, createdAt]);
    });
    return {
      account: { id, name, email, phone, role, status: 'active', mustChangePassword: true, createdAt },
      temporaryPassword: password,
    };
  }

  /**
   * Modifie un compte du personnel de son restaurant. Deux formes de corps, jamais mélangées :
   * - `{ status: 'inactive' | 'active' }` désactive ou réactive le compte ;
   * - `{ name?, phone?, role? }` (au moins un champ) change son nom, son téléphone ou son rôle (employé ou gérant).
   * L'e-mail est l'identifiant de connexion et ne change pas. Un administrateur ne touche ni à son propre rôle ni à son propre état.
   */
  update(user: AuthenticatedUser & { restaurantId: string }, id: string, input: unknown) {
    const body = input as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
      throw new AppError(400, 'INVALID_BODY', 'Indiquez ce qu’il faut modifier : l’état, ou le nom, le téléphone, le rôle.');
    }
    const target = this.db.get<StaffAccountRow>(
      `SELECT id, name, email, phone, role, status, must_change_password, created_at FROM users
       WHERE id = ? AND restaurant_id = ? AND role IN ('employee', 'manager', 'admin') AND status <> 'deleted'`,
      [id, user.restaurantId],
    );
    if (!target) throw new AppError(404, 'STAFF_ACCOUNT_NOT_FOUND', 'Compte du personnel introuvable.');
    if ('status' in body) return this.changeStatus(user, target, body);

    if (Object.keys(body).some((key) => !['name', 'phone', 'role'].includes(key))) {
      throw new AppError(400, 'INVALID_BODY', 'Seuls le nom, le téléphone et le rôle peuvent être modifiés.');
    }
    const next = { name: target.name, phone: target.phone, role: target.role };
    if ('name' in body) {
      const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
      if (name.length < 2 || name.length > 80) throw new AppError(400, 'INVALID_BODY', 'Le nom doit contenir de 2 à 80 caractères.');
      next.name = name;
    }
    if ('phone' in body) {
      const phone = normalizePhone(body['phone']);
      if (!phone) throw new AppError(400, 'INVALID_BODY', 'Le numéro de téléphone est invalide.');
      next.phone = phone;
    }
    if ('role' in body) {
      if (body['role'] !== 'employee' && body['role'] !== 'manager') {
        throw new AppError(400, 'INVALID_BODY', 'Le rôle doit être « employee » ou « manager ».');
      }
      if (id === user.id) throw new AppError(400, 'INVALID_BODY', 'Vous ne pouvez pas modifier votre propre rôle.');
      if (target.role === 'admin') throw new AppError(400, 'INVALID_BODY', 'Le rôle d’un administrateur ne peut pas être modifié ici.');
      next.role = body['role'];
    }
    // Changer le rôle ou le téléphone oblige à se reconnecter ; un simple changement de nom garde la session.
    const revoke = next.role !== target.role || next.phone !== target.phone;
    this.db.transaction(() => {
      if (next.phone !== target.phone && this.db.get('SELECT id FROM users WHERE phone = ? AND id <> ?', [next.phone, id])) {
        throw new AppError(409, 'ACCOUNT_TAKEN', 'Un compte existe déjà avec ce téléphone.');
      }
      this.db.run(`UPDATE users SET name = ?, phone = ?, role = ?${revoke ? ', auth_version = auth_version + 1' : ''} WHERE id = ?`,
        [next.name, next.phone, next.role, id]);
    });
    return { account: staffOutput({ ...target, ...next }) };
  }

  /**
   * Donne un nouveau mot de passe temporaire à un membre du personnel qui a tout oublié (sans SMS ni e-mail, c'est
   * la seule voie de secours). Un gérant ne réinitialise que les employés ; un administrateur, les employés et les
   * gérants, jamais un autre administrateur ni lui-même. Le mot de passe n'est montré qu'ici, une seule fois : la
   * personne doit le changer à sa prochaine connexion, ses anciennes sessions sont révoquées et un blocage levé.
   */
  resetPassword(user: AuthenticatedUser & { restaurantId: string }, id: string) {
    const target = this.db.get<StaffAccountRow>(
      `SELECT id, name, email, phone, role, status, must_change_password, created_at FROM users
       WHERE id = ? AND restaurant_id = ? AND role IN ('employee', 'manager', 'admin') AND status <> 'deleted'`,
      [id, user.restaurantId],
    );
    if (!target) throw new AppError(404, 'STAFF_ACCOUNT_NOT_FOUND', 'Compte du personnel introuvable.');
    if (target.id === user.id) throw new AppError(400, 'INVALID_BODY', 'Pour votre propre compte, changez votre mot de passe depuis votre profil.');
    const allowed = user.role === 'admin' ? ['employee', 'manager'] : ['employee'];
    if (!allowed.includes(target.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Vous ne pouvez pas réinitialiser le mot de passe de ce compte.');
    }
    if (target.status !== 'active') throw new AppError(409, 'ACCOUNT_INACTIVE', 'Ce compte est désactivé : réactivez-le d’abord.');
    const password = temporaryPassword();
    this.db.transaction(() => {
      this.db.run('UPDATE users SET password_hash = ?, must_change_password = 1, auth_version = auth_version + 1 WHERE id = ?', [hashPassword(password), target.id]);
      this.db.run('DELETE FROM auth_lockouts WHERE user_id = ?', [target.id]);
    });
    return { account: staffOutput({ ...target, must_change_password: 1 }), temporaryPassword: password };
  }

  private changeStatus(user: AuthenticatedUser & { restaurantId: string }, target: StaffAccountRow, body: Record<string, unknown>) {
    if (Object.keys(body).length !== 1 || (body['status'] !== 'inactive' && body['status'] !== 'active')) {
      throw new AppError(400, 'INVALID_BODY', 'L’état se change seul, vers « inactive » ou « active ».');
    }
    if (target.id === user.id) throw new AppError(400, 'INVALID_BODY', 'Vous ne pouvez pas modifier l’état de votre propre compte.');
    const status = body['status'];
    if (target.status !== status) {
      // La révocation des jetons couvre aussi la réactivation : l'ancienne session ne revient pas.
      this.db.run('UPDATE users SET status = ?, auth_version = auth_version + 1 WHERE id = ?', [status, target.id]);
    }
    return { id: target.id, status, account: staffOutput({ ...target, status }) };
  }
}
