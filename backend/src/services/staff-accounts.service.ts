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

  deactivate(user: AuthenticatedUser & { restaurantId: string }, id: string, input: unknown): { id: string; status: 'inactive' } {
    const body = input as Record<string, unknown> | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).length !== 1 || body['status'] !== 'inactive') {
      throw new AppError(400, 'INVALID_BODY', 'La seule modification permise est la désactivation du compte.');
    }
    if (id === user.id) throw new AppError(400, 'INVALID_BODY', 'Vous ne pouvez pas désactiver votre propre compte.');
    const result = this.db.run(
      `UPDATE users SET status = 'inactive', auth_version = auth_version + 1
       WHERE id = ? AND restaurant_id = ? AND role IN ('employee', 'manager', 'admin') AND status = 'active'`,
      [id, user.restaurantId],
    );
    if (!Number(result.changes)) throw new AppError(404, 'STAFF_ACCOUNT_NOT_FOUND', 'Compte du personnel introuvable.');
    return { id, status: 'inactive' };
  }
}
