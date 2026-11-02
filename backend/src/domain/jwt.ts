import { createHmac, timingSafeEqual } from 'node:crypto';

export interface BaseJwtPayload {
  exp?: number;
  [key: string]: unknown;
}

/**
 * Signe un jeton JWT en HS256 avec node:crypto (HMAC-SHA256).
 */
export function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 60 * 60 * 8,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload = {
    ...payload,
    exp: nowEpochSeconds + expiresInSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Vérifie un jeton JWT signé en HS256.
 * Refuse tout autre algorithme ou jeton expiré, compare la signature avec timingSafeEqual.
 */
export function verifyJwt<T extends BaseJwtPayload = BaseJwtPayload>(
  token: string,
  secret: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): T | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');

  // Supporte à la fois les jetons à 3 segments standard (header.payload.signature)
  // et les jetons compacts à 2 segments (payload.signature) utilisés en interne
  if (parts.length === 3) {
    const [headerB64, payloadB64, signatureB64] = parts;
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    try {
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as { alg?: string; typ?: string };
      if (header.alg !== 'HS256') return null;

      const data = `${headerB64}.${payloadB64}`;
      const expected = createHmac('sha256', secret).update(data).digest();
      const actual = Buffer.from(signatureB64, 'base64url');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as T;
      if (typeof payload.exp === 'number' && payload.exp <= nowEpochSeconds) return null;

      return payload;
    } catch {
      return null;
    }
  } else if (parts.length === 2) {
    const [payloadB64, signatureB64] = parts;
    if (!payloadB64 || !signatureB64) return null;

    try {
      const expected = createHmac('sha256', secret).update(payloadB64).digest();
      const actual = Buffer.from(signatureB64, 'base64url');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as T;
      if (typeof payload.exp === 'number' && payload.exp <= nowEpochSeconds) return null;

      return payload;
    } catch {
      return null;
    }
  }

  return null;
}
