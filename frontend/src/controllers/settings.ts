import { api } from '../models/http.ts';

export type Hours = Record<string, Array<{ open: string; close: string }>>;

export interface Settings {
  restaurant: { slug: string; name: string; tagline: string | null };
  brand: {
    primaryColor: string; secondaryColor: string; fontFamily: string;
    defaultMode: 'light' | 'dark' | 'system'; logoAssetId: string | null; logoUrl: string | null;
  };
  openingHours: Hours;
  delivery: { enabled: boolean; feeFc: number; communes: string[] };
  loyalty: { spendPerPointFc: number; pointsForReward: number; rewardValueFc: number; validityMonths: number };
}

export interface SettingsPatch {
  name?: string;
  tagline?: string | null;
  brand?: Partial<Pick<Settings['brand'], 'primaryColor' | 'secondaryColor' | 'fontFamily' | 'defaultMode' | 'logoAssetId'>>;
  openingHours?: Hours;
  delivery?: Partial<Settings['delivery']>;
  loyalty?: Partial<Settings['loyalty']>;
}

export const MAX_LOGO_BYTES = 512 * 1024;
export const FONTS = ['Poppins', 'Arial', 'Verdana', 'Trebuchet MS', 'Georgia', 'Tahoma', 'Times New Roman'];
export const DAYS: Array<[string, string]> = [
  ['mon', 'Lundi'], ['tue', 'Mardi'], ['wed', 'Mercredi'], ['thu', 'Jeudi'], ['fri', 'Vendredi'], ['sat', 'Samedi'], ['sun', 'Dimanche'],
];

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture de l’image impossible.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });
}

export const settingsApi = {
  get: () => api.get<Settings>('/admin/settings'),
  update: (patch: SettingsPatch) => api.patch<Settings>('/admin/settings', patch),
  uploadAsset: async (kind: 'logo' | 'poster' | 'menu', file: File) =>
    api.post<{ id: string; url: string }>('/admin/assets', { kind, data: await toBase64(file) }),
  uploadLogo: (file: File) => settingsApi.uploadAsset('logo', file),
};
