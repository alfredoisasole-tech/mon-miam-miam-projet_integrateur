export type Environnement = 'development' | 'test' | 'production';

export interface Config {
  env: Environnement;
  port: number;
  databasePath: string;
  jwtSecret: string;
  paymentWebhookSecret: string;
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

  return {
    env: mode,
    port: lirePort(env['PORT']),
    databasePath: env['DATABASE_PATH'] || './data/mon-miam-miam.sqlite',
    jwtSecret,
    paymentWebhookSecret,
    corsOrigins: (env['CORS_ORIGINS'] || 'http://localhost:5173')
      .split(',')
      .map((origine) => origine.trim())
      .filter((origine) => origine !== ''),
  };
}
