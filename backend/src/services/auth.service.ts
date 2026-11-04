import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Database } from '../db/database.ts';
import { AppError } from '../http/errors.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';
import {
  hashPassword,
  verifyPassword,
  isPasswordStrong,
  DUMMY_PASSWORD_HASH,
  PASSWORD_PATTERN,
} from '../domain/password.ts';
import { normalizePhone } from '../domain/phone.ts';
import { canonicalCommune } from '../domain/communes.ts';

export { hashPassword, verifyPassword, isPasswordStrong };

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 8;

export interface Account {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'student' | 'employee' | 'manager' | 'admin' | 'platform_admin';
  restaurantId: string | null;
  status: string;
  mustChangePassword: boolean;
  authVersion: number;
}

interface TokenPayload extends AuthenticatedUser {
  restaurantId: string | null;
  authVersion: number;
  exp: number;
}

function publicAccount(account: Account) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    phone: account.phone,
    role: account.role,
    mustChangePassword: account.mustChangePassword,
  };
}

type PublicProfile = ReturnType<typeof publicAccount> & {
  restaurant: { slug: string; name: string } | null;
  /** Adresse habituelle de livraison (étudiants) ; null pour le personnel et la plateforme. */
  commune: string | null;
  quartier: string | null;
  address: string | null;
};

export class AuthService {
  private readonly attempts = new Map<string, number[]>();
  private readonly db: Database;
  private readonly secret: string;
  private readonly now: () => Date;

  constructor(db: Database, secret: string, now: () => Date = () => new Date()) {
    this.db = db;
    this.secret = secret;
    this.now = now;
  }

  authenticate(token: string): AuthenticatedUser | null {
    let payload: TokenPayload;
    try {
      const [encoded, signature] = token.split('.');
      if (!encoded || !signature) return null;
      const expected = createHmac('sha256', this.secret).update(encoded).digest();
      const actual = Buffer.from(signature, 'base64url');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
      if (typeof payload.id !== 'string' || typeof payload.role !== 'string'
        || !Number.isInteger(payload.authVersion) || !Number.isInteger(payload.exp)
        || payload.exp <= Math.floor(this.now().getTime() / 1000)) return null;
    } catch {
      return null;
    }
    const account = this.findAccount(payload.id);
    if (!account || account.role !== payload.role || account.authVersion !== payload.authVersion) return null;
    return { id: account.id, role: account.role, restaurantId: account.restaurantId, status: account.status };
  }

  register(input: unknown, ip = 'unknown'): {
    token: string;
    user: ReturnType<typeof publicAccount> & { memberships: Array<{ restaurant: string; since: string }> };
  } {
    const bodyInput = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
    const emailKey = typeof bodyInput?.['email'] === 'string'
      ? `register:identifier:${bodyInput['email'].trim().toLowerCase()}` : null;
    const phoneKey = typeof bodyInput?.['phone'] === 'string'
      ? `register:phone:${normalizePhone(bodyInput['phone']) ?? bodyInput['phone'].trim()}` : null;
    const rateLimits = [
      ...(emailKey ? [{ key: emailKey, limit: 5 }] : []),
      ...(phoneKey ? [{ key: phoneKey, limit: 5 }] : []),
      { key: `register:ip:${ip}`, limit: 30 },
    ];
    if (rateLimits.some(({ key, limit }) => this.isLimited(key, limit))) {
      throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives, réessayez dans 15 minutes.');
    }

    try {
    if (!bodyInput) throw new AppError(400, 'INVALID_BODY', 'Les données du compte sont invalides.');
    const body = bodyInput;
    const name = this.requiredText(body['name'], 'name');
    const email = this.requiredText(body['email'], 'email').toLowerCase();
    const rawPhone = this.requiredText(body['phone'], 'phone');
    const phone = normalizePhone(rawPhone) ?? rawPhone;
    const password = body['password'];
    if (typeof password !== 'string' || password.length === 0) {
      throw new AppError(400, 'INVALID_BODY', 'Le champ password est obligatoire.');
    }
    const slug = this.requiredText(body['restaurant'], 'restaurant');
    if (body['confirmPassword'] !== undefined && body['confirmPassword'] !== password) {
      throw new AppError(400, 'INVALID_BODY', 'La confirmation du mot de passe ne correspond pas.');
    }
    if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+243\d{9}$/.test(phone)) {
      throw new AppError(400, 'INVALID_BODY', 'Le nom, l’e-mail ou le téléphone est invalide.');
    }
    if (!PASSWORD_PATTERN.test(password)) throw new AppError(400, 'WEAK_PASSWORD', 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.');
    if (body['acceptTerms'] !== true) throw new AppError(422, 'TERMS_NOT_ACCEPTED', 'Vous devez accepter les conditions d’utilisation.');
    const restaurant = this.db.get<{ id: string }>("SELECT id FROM restaurants WHERE slug = ? AND status = 'active'", [slug]);
    if (!restaurant) throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant introuvable ou désactivé.');
    if (this.db.get('SELECT id FROM users WHERE lower(email) = lower(?)', [email])
      || this.db.get('SELECT id FROM platform_admins WHERE lower(email) = lower(?)', [email])) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet e-mail ; connectez-vous.');
    }
    if (this.db.get('SELECT id FROM users WHERE phone = ?', [phone])) throw new AppError(409, 'PHONE_TAKEN', 'Un compte existe déjà avec ce téléphone ; connectez-vous.');

    const id = `usr_${randomBytes(12).toString('hex')}`;
    const createdAt = this.now().toISOString();
    const referralCode = this.optionalText(body['referralCode'])?.toUpperCase() ?? null;
    const ownReferralCode = randomBytes(6).toString('hex').toUpperCase();
    const passwordHash = hashPassword(password);
    const referrer = referralCode ? this.db.get<{ id: string }>(
      "SELECT id FROM users WHERE referral_code = ? AND role = 'student' AND status = 'active'",
      [referralCode],
    ) : undefined;
    if (referralCode && !referrer) {
      throw new AppError(422, 'INVALID_REFERRAL_CODE', 'Ce code de parrainage est inconnu. Vérifiez-le auprès de votre ami ou laissez le champ vide.');
    }
    this.db.transaction(() => {
      if (this.db.get('SELECT id FROM users WHERE lower(email) = lower(?)', [email])
        || this.db.get('SELECT id FROM platform_admins WHERE lower(email) = lower(?)', [email])) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet e-mail ; connectez-vous.');
      }
      if (this.db.get('SELECT id FROM users WHERE phone = ?', [phone])) {
        throw new AppError(409, 'PHONE_TAKEN', 'Un compte existe déjà avec ce téléphone ; connectez-vous.');
      }
      this.db.run(`INSERT INTO users (id, restaurant_id, role, name, email, phone, password_hash, commune, quartier, address, referral_code, accepted_terms_at, created_at, referred_by)
        VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, restaurant.id, name, email, phone, passwordHash,
        this.optionalText(body['commune']), this.optionalText(body['quartier']),
        this.optionalText(body['deliveryAddress'] ?? body['adresse']),
        ownReferralCode, createdAt, createdAt, referrer?.id ?? null]);
      this.db.run('INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES (?, ?, ?)', [id, restaurant.id, createdAt]);
    });
    const account = this.findAccount(id);
    if (!account) throw new Error('Le compte vient d’être créé mais ne peut pas être relu.');
    if (emailKey) this.attempts.delete(emailKey);
    if (phoneKey) this.attempts.delete(phoneKey);
    return {
      token: this.issueToken(account),
      user: {
        ...publicAccount(account),
        memberships: this.db.all<{ restaurant: string; since: string }>(
          `SELECT r.slug AS restaurant, m.created_at AS since FROM memberships m
           JOIN restaurants r ON r.id = m.restaurant_id WHERE m.user_id = ? ORDER BY m.created_at`,
          [id],
        ),
      },
    };
    } catch (error) {
      if (error instanceof AppError && error.status >= 400 && error.status < 500 && error.code !== 'TOO_MANY_ATTEMPTS') {
        for (const { key } of rateLimits) this.recordFailure(key);
        if (rateLimits.some(({ key, limit }) => this.isLimited(key, limit))) {
          throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives, réessayez dans 15 minutes.');
        }
      }
      throw error;
    }
  }

  login(identifierInput: unknown, passwordInput: unknown, ip: string): { token: string; user: PublicProfile } {
    const identifier = typeof identifierInput === 'string' ? identifierInput.trim().toLowerCase() : '';
    const password = typeof passwordInput === 'string' ? passwordInput : '';
    if (!identifier || !password) throw new AppError(400, 'INVALID_BODY', 'Identifiant ou mot de passe manquant.');
    const keys = [{ key: `identifier:${identifier}`, limit: 5 }, { key: `ip:${ip}`, limit: 30 }];
    const account = this.findAccountByIdentifier(identifier);
    if (account && account.role !== 'platform_admin'
      && this.db.get('SELECT user_id FROM auth_lockouts WHERE user_id = ?', [account.id])) {
      throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives ; réinitialisez votre mot de passe pour récupérer le compte.');
    }
    if (keys.some(({ key, limit }) => this.isLimited(key, limit))) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives, réessayez dans 15 minutes.');
    const validPassword = verifyPassword(password, account ? this.getPasswordHash(account.id) : DUMMY_PASSWORD_HASH);
    if (!account || !validPassword) {
      for (const { key } of keys) this.recordFailure(key);
      const accountLocked = this.isLimited(keys[0]!.key, keys[0]!.limit);
      if (keys.some(({ key, limit }) => this.isLimited(key, limit))) {
        if (account && account.role !== 'platform_admin' && accountLocked) {
          this.db.run('INSERT INTO auth_lockouts (user_id, locked_at) VALUES (?, ?) ON CONFLICT (user_id) DO NOTHING',
            [account.id, this.now().toISOString()]);
        }
        throw new AppError(429, 'TOO_MANY_ATTEMPTS', accountLocked
          ? 'Trop de tentatives ; réinitialisez votre mot de passe pour récupérer le compte.'
          : 'Trop de tentatives, réessayez dans 15 minutes.');
      }
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Identifiants incorrects.');
    }
    if (account.status !== 'active') throw new AppError(403, 'ACCOUNT_DISABLED', 'Ce compte est désactivé.');
    this.attempts.delete(keys[0]!.key);
    return { token: this.issueToken(account), user: this.withRestaurant(account) };
  }

  async forgotPassword(
    identifierInput: unknown,
    sendCode?: (identifier: string, code: string) => Promise<void>,
  ): Promise<{ message: string }> {
    const identifier = typeof identifierInput === 'string' ? identifierInput.trim().toLowerCase() : '';
    if (!identifier) throw new AppError(400, 'INVALID_BODY', 'Identifiant manquant.');
    if (!sendCode) throw new AppError(503, 'RESET_DELIVERY_UNAVAILABLE', 'Le service d’envoi des codes de réinitialisation n’est pas configuré.');
    const key = `reset:${identifier}`;
    if (this.isLimited(key)) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives, réessayez dans 15 minutes.');
    this.recordFailure(key);
    const account = this.db.get<{ id: string; email: string; phone: string }>(
      'SELECT id, email, phone FROM users WHERE lower(email) = lower(?) OR phone = ?', [identifier, identifier],
    );
    if (account) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      const createdAt = this.now().toISOString();
      const tokenHash = createHmac('sha256', this.secret).update(`${account.id}:${code}`).digest('hex');
      this.db.run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [createdAt, account.id]);
      this.db.run('INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
        [`reset_${randomBytes(12).toString('hex')}`, account.id, tokenHash, new Date(this.now().getTime() + 60 * 60 * 1000).toISOString(), createdAt]);
      try {
        await sendCode(identifier.includes('@') ? account.email : account.phone, code);
      } catch {
        this.db.run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', [this.now().toISOString(), tokenHash]);
        console.error('Échec de livraison d’un code de réinitialisation ; le jeton a été invalidé.');
      }
    }
    return { message: 'Si ce compte existe, un code de réinitialisation a été envoyé.' };
  }

  resetPassword(identifierInput: unknown, codeInput: unknown, newPasswordInput: unknown): { message: string } {
    const identifier = typeof identifierInput === 'string' ? identifierInput.trim().toLowerCase() : '';
    const code = typeof codeInput === 'string' ? codeInput.trim().toUpperCase() : '';
    if (!identifier || !code || typeof newPasswordInput !== 'string' || !newPasswordInput) {
      throw new AppError(400, 'INVALID_BODY', 'Identifiant, code et nouveau mot de passe sont obligatoires.');
    }
    const resetKey = `reset-code:${identifier}`;
    if (this.isLimited(resetKey)) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives, réessayez dans 15 minutes.');
    const account = this.db.get<{ id: string }>(
      'SELECT id FROM users WHERE lower(email) = lower(?) OR phone = ?', [identifier, identifier],
    );
    const tokenHash = account ? createHmac('sha256', this.secret).update(`${account.id}:${code}`).digest('hex') : '';
    const reset = tokenHash ? this.db.get<{ id: string }>(
      'SELECT id FROM password_resets WHERE user_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > ?',
      [account!.id, tokenHash, this.now().toISOString()],
    ) : undefined;
    if (!account || !reset) {
      this.recordFailure(resetKey);
      throw new AppError(422, 'INVALID_CODE', 'Code invalide ou expiré.');
    }
    const usedAt = this.now().toISOString();
    if (!PASSWORD_PATTERN.test(newPasswordInput)) {
      this.db.run('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?',
        [usedAt, reset.id, usedAt]);
      throw new AppError(422, 'WEAK_PASSWORD', 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.');
    }
    const passwordHash = hashPassword(newPasswordInput);
    this.db.transaction(() => {
      const result = this.db.run('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?',
        [usedAt, reset.id, usedAt]);
      if (!result.changes) throw new AppError(422, 'INVALID_CODE', 'Code invalide ou expiré.');
      this.db.run('UPDATE users SET password_hash = ?, must_change_password = 0, auth_version = auth_version + 1 WHERE id = ?', [passwordHash, account.id]);
      this.db.run('DELETE FROM auth_lockouts WHERE user_id = ?', [account.id]);
    });
    return { message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' };
  }

  /**
   * Changement de mot de passe par la personne connectée (obligatoire à la première connexion d'un compte du personnel).
   * Les anciens jetons deviennent invalides ; un nouveau jeton est renvoyé.
   */
  changePassword(userId: string, currentInput: unknown, newInput: unknown): { token: string; user: PublicProfile } {
    const current = typeof currentInput === 'string' ? currentInput : '';
    const next = typeof newInput === 'string' ? newInput : '';
    if (!current || !next) throw new AppError(400, 'INVALID_BODY', 'Le mot de passe actuel et le nouveau mot de passe sont obligatoires.');
    const key = `change-password:${userId}`;
    if (this.isLimited(key)) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives, réessayez dans 15 minutes.');
    const account = this.findAccount(userId);
    if (!account || account.status !== 'active') throw new AppError(403, 'ACCOUNT_DISABLED', 'Ce compte est désactivé.');
    if (!verifyPassword(current, this.getPasswordHash(account.id))) {
      this.recordFailure(key);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Le mot de passe actuel est incorrect.');
    }
    if (!PASSWORD_PATTERN.test(next)) {
      throw new AppError(422, 'WEAK_PASSWORD', 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.');
    }
    if (next === current) throw new AppError(422, 'SAME_PASSWORD', 'Le nouveau mot de passe doit être différent de l’actuel.');
    const passwordHash = hashPassword(next);
    if (account.role === 'platform_admin') {
      this.db.run('UPDATE platform_admins SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ?', [passwordHash, account.id]);
    } else {
      this.db.run('UPDATE users SET password_hash = ?, must_change_password = 0, auth_version = auth_version + 1 WHERE id = ?', [passwordHash, account.id]);
      this.db.run('DELETE FROM auth_lockouts WHERE user_id = ?', [account.id]);
    }
    this.attempts.delete(key);
    const updated = this.findAccount(account.id);
    if (!updated) throw new Error('Le compte vient d’être modifié mais ne peut pas être relu.');
    return { token: this.issueToken(updated), user: this.withRestaurant(updated) };
  }

  profile(userId: string): PublicProfile {
    const account = this.findAccount(userId);
    if (!account || account.status !== 'active') throw new AppError(403, 'ACCOUNT_DISABLED', 'Ce compte est désactivé.');
    return this.withRestaurant(account);
  }

  /** Le personnel d'un restaurant reçoit son restaurant (le site en déduit la charte graphique) ; étudiants et plateforme, non. */
  private withRestaurant(account: Account): PublicProfile {
    const staff = account.role === 'employee' || account.role === 'manager' || account.role === 'admin';
    const restaurant = staff && account.restaurantId
      ? this.db.get<{ slug: string; name: string }>('SELECT slug, name FROM restaurants WHERE id = ?', [account.restaurantId]) ?? null
      : null;
    const delivery = account.role === 'platform_admin' ? undefined
      : this.db.get<{ commune: string | null; quartier: string | null; address: string | null }>('SELECT commune, quartier, address FROM users WHERE id = ?', [account.id]);
    return { ...publicAccount(account), restaurant, commune: delivery?.commune ?? null, quartier: delivery?.quartier ?? null, address: delivery?.address ?? null };
  }

  /**
   * Modification de ses propres coordonnées : nom, téléphone et, pour un étudiant, adresse habituelle de livraison.
   * L'e-mail est l'identifiant de connexion et ne change pas. Changer de numéro exige le mot de passe actuel, car le
   * numéro sert aussi à se connecter et à retrouver un compte. La session reste valable.
   */
  updateProfile(userId: string, input: unknown): PublicProfile {
    const body = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : null;
    const FIELDS = ['name', 'phone', 'currentPassword', 'commune', 'quartier', 'address'];
    const changes = body ? Object.keys(body).filter((key) => key !== 'currentPassword') : [];
    if (!body || changes.length === 0 || Object.keys(body).some((key) => !FIELDS.includes(key))) {
      throw new AppError(400, 'INVALID_BODY', 'Indiquez ce qu’il faut modifier : le nom, le téléphone ou l’adresse habituelle.');
    }
    const account = this.findAccount(userId);
    if (!account || account.status !== 'active') throw new AppError(403, 'ACCOUNT_DISABLED', 'Ce compte est désactivé.');
    if (account.role === 'platform_admin') throw new AppError(403, 'FORBIDDEN', 'Ce compte n’a pas de coordonnées à modifier ici.');
    if (account.mustChangePassword) throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Changez d’abord votre mot de passe temporaire.');
    const student = account.role === 'student';
    if (!student && ['commune', 'quartier', 'address'].some((key) => key in body)) {
      throw new AppError(400, 'INVALID_BODY', 'L’adresse habituelle ne concerne que les étudiants.');
    }

    const next: Record<string, string | null> = {};
    if ('name' in body) {
      const name = typeof body['name'] === 'string' ? body['name'].trim() : '';
      if (name.length < 2 || name.length > 80) throw new AppError(400, 'INVALID_BODY', 'Le nom doit contenir de 2 à 80 caractères.');
      next['name'] = name;
    }
    if ('phone' in body) {
      const phone = normalizePhone(body['phone']);
      if (!phone) throw new AppError(400, 'INVALID_BODY', 'Le numéro de téléphone est invalide (format +243XXXXXXXXX).');
      if (phone !== account.phone) {
        const key = `profile-password:${userId}`;
        if (typeof body['currentPassword'] !== 'string' || !body['currentPassword']) {
          throw new AppError(400, 'INVALID_BODY', 'Indiquez votre mot de passe actuel pour changer de numéro.');
        }
        if (this.isLimited(key)) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives, réessayez dans 15 minutes.');
        if (!verifyPassword(body['currentPassword'], this.getPasswordHash(account.id))) {
          this.recordFailure(key);
          throw new AppError(401, 'INVALID_CREDENTIALS', 'Le mot de passe actuel est incorrect.');
        }
        this.attempts.delete(key);
        if (this.db.get('SELECT id FROM users WHERE phone = ? AND id <> ?', [phone, account.id])) {
          throw new AppError(409, 'PHONE_TAKEN', 'Un compte existe déjà avec ce téléphone.');
        }
        next['phone'] = phone;
      }
    }
    const optional = (key: string, max: number, label: string): string | null => {
      const value = body[key];
      if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
      if (typeof value !== 'string' || value.trim().length > max) throw new AppError(400, 'INVALID_BODY', `${label} : ${max} caractères au plus.`);
      return value.trim();
    };
    if ('commune' in body) {
      const raw = optional('commune', 40, 'La commune');
      const commune = raw === null ? null : canonicalCommune(raw);
      if (raw !== null && !commune) throw new AppError(400, 'INVALID_BODY', 'Cette commune n’est pas une commune de Kinshasa.');
      next['commune'] = commune;
    }
    if ('quartier' in body) next['quartier'] = optional('quartier', 80, 'Le quartier');
    if ('address' in body) next['address'] = optional('address', 200, 'L’adresse');

    const columns = Object.keys(next);
    if (columns.length > 0) {
      this.db.run(`UPDATE users SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`, [...columns.map((column) => next[column]), account.id]);
    }
    const updated = this.findAccount(account.id);
    if (!updated) throw new Error('Le compte vient d’être modifié mais ne peut pas être relu.');
    return this.withRestaurant(updated);
  }

  private issueToken(account: Account): string {
    const payload: TokenPayload = {
      id: account.id,
      role: account.role,
      restaurantId: account.restaurantId,
      authVersion: account.authVersion,
      exp: Math.floor(this.now().getTime() / 1000) + TOKEN_LIFETIME_SECONDS,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.secret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }

  private findAccount(id: string): Account | null {
    const user = this.db.get<Omit<Account, 'mustChangePassword' | 'authVersion'> & { must_change_password: number; auth_version: number }>(
      `SELECT id, name, email, phone, role, restaurant_id AS restaurantId, status, must_change_password, auth_version
       FROM users WHERE id = ?`, [id]);
    if (user) return { ...user, mustChangePassword: user.must_change_password === 1, authVersion: user.auth_version };
    const admin = this.db.get<Omit<Account, 'mustChangePassword' | 'phone' | 'restaurantId' | 'authVersion'> & { must_change_password: number; auth_version: number }>(
      `SELECT id, name, email, '' AS phone, 'platform_admin' AS role, NULL AS restaurantId, status, 0 AS must_change_password, auth_version
       FROM platform_admins WHERE id = ?`, [id]);
    return admin ? { ...admin, role: 'platform_admin', phone: '', restaurantId: null, mustChangePassword: false, authVersion: admin.auth_version } : null;
  }

  private findAccountByIdentifier(identifier: string): Account | null {
    const user = this.db.get<{ id: string }>('SELECT id FROM users WHERE lower(email) = lower(?) OR phone = ?', [identifier, identifier]);
    const admin = user ? undefined : this.db.get<{ id: string }>('SELECT id FROM platform_admins WHERE lower(email) = lower(?)', [identifier]);
    const found = user?.id ?? admin?.id;
    return found ? this.findAccount(found) : null;
  }

  private getPasswordHash(id: string): string {
    return this.db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [id])?.password_hash
      ?? this.db.get<{ password_hash: string }>('SELECT password_hash FROM platform_admins WHERE id = ?', [id])?.password_hash
      ?? '';
  }

  private requiredText(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new AppError(400, 'INVALID_BODY', `Le champ ${field} est obligatoire.`);
    return value.trim();
  }

  private optionalText(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') throw new AppError(400, 'INVALID_BODY', 'Un champ texte facultatif est invalide.');
    return value.trim() || null;
  }

  private isLimited(key: string, limit = 8): boolean {
    const cutoff = this.now().getTime() - 15 * 60 * 1000;
    const recent = (this.attempts.get(key) ?? []).filter((time) => time > cutoff);
    this.attempts.set(key, recent);
    return recent.length >= limit;
  }

  private recordFailure(key: string): void {
    const now = this.now().getTime();
    const cutoff = now - 15 * 60 * 1000;
    for (const [storedKey, timestamps] of this.attempts) {
      const recent = timestamps.filter((timestamp) => timestamp > cutoff);
      if (recent.length) this.attempts.set(storedKey, recent);
      else this.attempts.delete(storedKey);
    }
    if (this.attempts.size >= 10_000 && !this.attempts.has(key)) {
      const oldest = this.attempts.keys().next().value as string | undefined;
      if (oldest) this.attempts.delete(oldest);
    }
    this.attempts.set(key, [...(this.attempts.get(key) ?? []), now]);
  }
}
