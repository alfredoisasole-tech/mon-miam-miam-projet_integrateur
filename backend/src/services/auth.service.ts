import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Database } from '../db/database.ts';
import { AppError } from '../http/errors.ts';
import type { AuthenticatedUser } from '../domain/orders.ts';

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 8;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
const DUMMY_PASSWORD_HASH = 'scrypt$00112233445566778899aabbccddeeff$'
  + 'b4c99c1a8ed980a70e4d95e37d2c7d148295e6b1a326c6f828bd48a0a13c22c7'
  + 'fdca1f10b986ff3a01909e46fc6c9e6d3fc9cab59b5e9fb65cf14a5d97e1a60a';

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

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function passwordMatches(password: string, encoded: string): boolean {
  const [algorithm, saltHex, hashHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex || !/^[a-f\d]+$/i.test(saltHex) || !/^[a-f\d]+$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
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

export class AuthService {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly db: Database,
    private readonly secret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

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
    const registrationKey = `register:${ip}`;
    if (this.isLimited(registrationKey)) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives, réessayez dans 15 minutes.');
    this.recordFailure(registrationKey);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400, 'INVALID_BODY', 'Les données du compte sont invalides.');
    const body = input as Record<string, unknown>;
    const name = this.requiredText(body['name'], 'name');
    const email = this.requiredText(body['email'], 'email').toLowerCase();
    const phone = this.requiredText(body['phone'], 'phone');
    const password = this.requiredText(body['password'], 'password');
    const slug = this.requiredText(body['restaurant'], 'restaurant');
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
    const referralCode = this.optionalText(body['referralCode']);
    const ownReferralCode = randomBytes(6).toString('hex').toUpperCase();
    const passwordHash = hashPassword(password);
    const referrer = referralCode ? this.db.get<{ id: string; restaurant_id: string }>(
      "SELECT id, restaurant_id FROM users WHERE referral_code = ? AND role = 'student' AND status = 'active'",
      [referralCode],
    ) : undefined;
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
        this.optionalText(body['commune']), this.optionalText(body['quartier']), this.optionalText(body['adresse']),
        ownReferralCode, createdAt, createdAt, referrer?.id ?? null]);
      this.db.run('INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES (?, ?, ?)', [id, restaurant.id, createdAt]);
      if (referrer) {
        this.db.run('INSERT INTO memberships (user_id, restaurant_id, created_at) VALUES (?, ?, ?) ON CONFLICT (user_id, restaurant_id) DO NOTHING',
          [referrer.id, restaurant.id, createdAt]);
        this.db.run(`INSERT INTO referrals (id, restaurant_id, referrer_id, referee_id, created_at)
          VALUES (?, ?, ?, ?, ?)`, [`ref_${randomBytes(12).toString('hex')}`, restaurant.id, referrer.id, id, createdAt]);
      }
    });
    this.attempts.delete(registrationKey);
    const account = this.findAccount(id);
    if (!account) throw new Error('Le compte vient d’être créé mais ne peut pas être relu.');
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
  }

  login(identifierInput: unknown, passwordInput: unknown, ip: string): { token: string; user: ReturnType<typeof publicAccount> } {
    const identifier = typeof identifierInput === 'string' ? identifierInput.trim().toLowerCase() : '';
    const password = typeof passwordInput === 'string' ? passwordInput : '';
    if (!identifier || !password) throw new AppError(400, 'INVALID_BODY', 'Identifiant ou mot de passe manquant.');
    const keys = [`identifier:${identifier}`, `ip:${ip}`];
    const account = this.findAccountByIdentifier(identifier);
    if (account && account.role !== 'platform_admin'
      && this.db.get('SELECT user_id FROM auth_lockouts WHERE user_id = ?', [account.id])) {
      throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives ; réinitialisez votre mot de passe pour récupérer le compte.');
    }
    if (keys.some((key) => this.isLimited(key))) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Trop de tentatives, réessayez dans 15 minutes.');
    const validPassword = passwordMatches(password, account ? this.getPasswordHash(account.id) : DUMMY_PASSWORD_HASH);
    if (!account || !validPassword) {
      for (const key of keys) this.recordFailure(key);
      const accountLocked = (this.attempts.get(keys[0]!)?.length ?? 0) >= 8;
      if (keys.some((key) => (this.attempts.get(key)?.length ?? 0) >= 8)) {
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
    for (const key of keys) this.attempts.delete(key);
    return { token: this.issueToken(account), user: publicAccount(account) };
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

  profile(userId: string): ReturnType<typeof publicAccount> {
    const account = this.findAccount(userId);
    if (!account || account.status !== 'active') throw new AppError(403, 'ACCOUNT_DISABLED', 'Ce compte est désactivé.');
    return publicAccount(account);
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
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private isLimited(key: string): boolean {
    const cutoff = this.now().getTime() - 15 * 60 * 1000;
    const recent = (this.attempts.get(key) ?? []).filter((time) => time > cutoff);
    this.attempts.set(key, recent);
    return recent.length >= 8;
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
