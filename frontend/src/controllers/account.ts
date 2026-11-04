import { api } from '../models/http.ts';

export const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_RULE = '8 caractères minimum, avec au moins une majuscule et un chiffre.';

/** Enregistre un objet JSON sur l'appareil de l'utilisateur. */
function saveJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const accountApi = {
  forgotPassword: (identifier: string) => api.post<unknown>('/auth/forgot-password', { identifier }).then(() => undefined),
  resetPassword: (identifier: string, code: string, newPassword: string) =>
    api.post<unknown>('/auth/reset-password', { identifier, code, newPassword }).then(() => undefined),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ token: string }>('/auth/change-password', { currentPassword, newPassword }),
  exportData: async () => saveJson(await api.get<unknown>('/me/export'), 'mes-donnees.json'),
  deleteAccount: (password: string) => api.delete<unknown>('/me', { password }).then(() => undefined),
};
