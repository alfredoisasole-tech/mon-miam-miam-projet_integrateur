import { AppError } from '../http/errors.ts';
import { ASSET_KINDS, MAX_ASSET_BYTES, type AssetKind } from './branding.ts';

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

/** Reconnaît PNG, JPEG et WebP par leur signature : le nom ou le type annoncé par le client ne comptent pas. SVG est refusé. */
export function detectImageMime(bytes: Uint8Array): ImageMime | null {
  const startsWith = (signature: number[], offset = 0) => signature.every((value, index) => bytes[offset + index] === value);
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

export interface ParsedUpload { kind: AssetKind; bytes: Buffer; mime: ImageMime }

export function parseUpload(input: unknown): ParsedUpload {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Le corps de la requête doit être un objet JSON.');
  }
  const body = input as Record<string, unknown>;
  const kind = body['kind'];
  if (typeof kind !== 'string' || !(ASSET_KINDS as readonly string[]).includes(kind)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Le type d’image doit être « logo », « poster » ou « menu ».', [{ field: 'kind', message: 'Type d’image invalide.' }]);
  }
  const data = body['data'];
  if (typeof data !== 'string' || data.length === 0 || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'L’image doit être envoyée en base64.', [{ field: 'data', message: 'Image invalide.' }]);
  }
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > MAX_ASSET_BYTES) {
    throw new AppError(413, 'IMAGE_TOO_LARGE', `L’image ne doit pas dépasser ${MAX_ASSET_BYTES / 1024} Ko.`);
  }
  const mime = detectImageMime(bytes);
  if (!mime) throw new AppError(400, 'UNSUPPORTED_IMAGE', 'Seules les images PNG, JPEG et WebP sont acceptées.');
  return { kind: kind as AssetKind, bytes, mime };
}
