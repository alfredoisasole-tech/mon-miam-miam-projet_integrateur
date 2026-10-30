export type Environnement = 'development' | 'test' | 'production';

export interface Config {
  env: Environnement;
  port: number;
  databasePath: string;
  jwtSecret: string;
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
const DEV_JWT_SECRET = 'secret-de-developpement-a-ne-jamais-utiliser-en-production';
const MIN_SECRET_LENGTH = 32;

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
  if (mode === 'production') {
    if (jwtSecret.length < MIN_SECRET_LENGTH || jwtSecret.toLowerCase().includes('changez-moi')) {
      throw new ConfigError(`JWT_SECRET est obligatoire en production : ${MIN_SECRET_LENGTH} caractères minimum, différent de la valeur d'exemple.`);
    }
  } else if (jwtSecret === '') {
    jwtSecret = DEV_JWT_SECRET;
  }

  return {
    env: mode,
    port: lirePort(env['PORT']),
    databasePath: env['DATABASE_PATH'] || './data/mon-miam-miam.sqlite',
    jwtSecret,
    corsOrigins: (env['CORS_ORIGINS'] || 'http://localhost:5173')
      .split(',')
      .map((origine) => origine.trim())
      .filter((origine) => origine !== ''),
  };
}
