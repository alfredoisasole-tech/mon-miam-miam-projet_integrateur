export type Environnement = 'development' | 'test' | 'production';

export type PaymentProviderName = 'simulation' | 'easypay';
export type EasypayMode = 'sandbox' | 'v1';

/** Configuration de la passerelle e-COM EasyPay. Les identifiants viennent uniquement de l'environnement. */
export interface EasypayConfig {
  mode: EasypayMode;
  /** Identifiant de corrélation du marchand (« Correlation Id »). */
  cid: string;
  /** Clé de l'espace développeur (« Token »). Elle voyage dans l'adresse des appels : ne jamais la journaliser. */
  token: string;
  /** Clé secrète ajoutée à l'adresse de notification (IPN) pour écarter les appels étrangers. */
  ipnKey: string;
  /** Adresse publique du site, sans « / » final : base des adresses de retour après paiement. */
  siteUrl: string;
}

export interface Config {
  env: Environnement;
  port: number;
  databasePath: string;
  jwtSecret: string;
  paymentWebhookSecret: string;
  /** Fournisseur de paiement : la simulation par défaut, ou Easypay. */
  paymentProvider: PaymentProviderName;
  easypay: EasypayConfig | null;
  /** Adresses du site autorisées à appeler l'API (CORS). */
  corsOrigins: string[];
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Valeur écrite dans .env.example : elle est publique, donc interdite en production. */
export const EXAMPLE_JWT_SECRET = 'changez-moi-avec-une-longue-valeur-aleatoire-de-32-caracteres-minimum';
export const EXAMPLE_PAYMENT_WEBHOOK_SECRET = 'cle-non-secrete-a-remplacer-par-une-valeur-aleatoire-en-production';
const DEV_JWT_SECRET = 'secret-de-developpement-a-ne-jamais-utiliser-en-production';
const DEV_PAYMENT_WEBHOOK_SECRET = 'cle-non-secrete-pour-le-mode-simule-en-developpement';
const MIN_SECRET_LENGTH = 32;
const NON_SECRET_MARKERS = /non-secr[eè]te|changez-moi|remplacez|en-developpement|en-production/i;

function lireEasypay(env: NodeJS.ProcessEnv, mode: Environnement): EasypayConfig {
  const requis = (nom: string): string => {
    const valeur = (env[nom] ?? '').trim();
    if (valeur === '') throw new ConfigError(`${nom} est obligatoire quand PAYMENT_PROVIDER vaut easypay.`);
    return valeur;
  };
  const easypayMode = (env['EASYPAY_MODE'] ?? '').trim() || 'sandbox';
  if (easypayMode !== 'sandbox' && easypayMode !== 'v1') {
    throw new ConfigError('EASYPAY_MODE doit valoir « sandbox » (essais) ou « v1 » (production).');
  }
  const cid = requis('EASYPAY_CID');
  const token = requis('EASYPAY_TOKEN');
  const ipnKey = requis('EASYPAY_IPN_KEY');
  if (ipnKey.length < MIN_SECRET_LENGTH) {
    throw new ConfigError(`EASYPAY_IPN_KEY doit contenir ${MIN_SECRET_LENGTH} caractères minimum.`);
  }
  const brute = requis('SITE_URL');
  let adresse: URL;
  try { adresse = new URL(brute); } catch { throw new ConfigError('SITE_URL doit être une adresse valide, par exemple https://site.exemple.'); }
  if (adresse.protocol !== 'https:' && adresse.protocol !== 'http:') {
    throw new ConfigError('SITE_URL doit commencer par https:// (ou http:// en développement).');
  }
  if (mode === 'production' && adresse.protocol !== 'https:') {
    throw new ConfigError('SITE_URL doit commencer par https:// en production.');
  }
  return { mode: easypayMode, cid, token, ipnKey, siteUrl: brute.replace(/\/+$/, '') };
}

function lirePort(brut: string | undefined): number {
  if (brut === undefined || brut === '') return 3000;
  const port = Number(brut);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError('PORT doit être un nombre entier entre 1 et 65535.');
  }
  return port;
}

/** Lit la configuration depuis les variables d'environnement. En production, refuse de démarrer avec un secret faible. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode: Environnement = env['NODE_ENV'] === 'production' ? 'production' : env['NODE_ENV'] === 'test' ? 'test' : 'development';

  let jwtSecret = env['JWT_SECRET'] ?? '';
  let paymentWebhookSecret = env['PAYMENT_WEBHOOK_SECRET'] ?? '';
  if (mode === 'production') {
    if (jwtSecret.length < MIN_SECRET_LENGTH || jwtSecret.toLowerCase().includes('changez-moi')) {
      throw new ConfigError(`JWT_SECRET est obligatoire en production : ${MIN_SECRET_LENGTH} caractères minimum, différent de la valeur d'exemple.`);
    }
    if (paymentWebhookSecret.length < MIN_SECRET_LENGTH || NON_SECRET_MARKERS.test(paymentWebhookSecret)) {
      throw new ConfigError(`PAYMENT_WEBHOOK_SECRET est obligatoire en production : ${MIN_SECRET_LENGTH} caractères minimum, différent de la valeur non secrète de développement.`);
    }
  } else if (jwtSecret === '') {
    jwtSecret = DEV_JWT_SECRET;
  }
  if (mode !== 'production' && paymentWebhookSecret === '') paymentWebhookSecret = DEV_PAYMENT_WEBHOOK_SECRET;

  const fournisseur = (env['PAYMENT_PROVIDER'] ?? '').trim() || 'simulation';
  if (fournisseur !== 'simulation' && fournisseur !== 'easypay') {
    throw new ConfigError('PAYMENT_PROVIDER doit valoir « simulation » ou « easypay ».');
  }

  return {
    env: mode,
    port: lirePort(env['PORT']),
    databasePath: env['DATABASE_PATH'] || './data/mon-miam-miam.sqlite',
    jwtSecret,
    paymentWebhookSecret,
    paymentProvider: fournisseur,
    easypay: fournisseur === 'easypay' ? lireEasypay(env, mode) : null,
    corsOrigins: (env['CORS_ORIGINS'] || 'http://localhost:5173')
      .split(',')
      .map((origine) => origine.trim())
      .filter((origine) => origine !== ''),
  };
}
