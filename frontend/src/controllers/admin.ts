import { api } from '../models/http.ts';

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'employee' | 'manager' | 'admin';
  status: string;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AdminPromotion {
  id: string;
  type: 'promotion' | 'event' | 'game';
  title: string;
  description: string | null;
  imageAssetId: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface PromotionInput {
  type: AdminPromotion['type'];
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  imageAssetId?: string;
}

export interface PlatformRestaurant {
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  students: number;
  administrators: Array<{ name: string; email: string }>;
  logoUrl?: string | null;
  colors?: { primary: string; secondary: string };
}

export interface NewRestaurant {
  slug: string;
  name: string;
  admin: { name: string; email: string; phone: string; password: string };
}

export const PHONE_RE = /^\+243\d{9}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const adminApi = {
  listStaff: () => api.get<StaffAccount[]>('/staff/accounts'),
  createStaff: (input: { name: string; email: string; phone: string; role: 'employee' | 'manager' }) =>
    api.post<{ account: StaffAccount; temporaryPassword: string }>('/staff/accounts', input),
  deactivateStaff: (id: string) => api.patch<{ id: string; status: 'inactive' }>(`/staff/accounts/${encodeURIComponent(id)}`, { status: 'inactive' }),
  reactivateStaff: (id: string) => api.patch<{ id: string; status: 'active'; account: StaffAccount }>(`/staff/accounts/${encodeURIComponent(id)}`, { status: 'active' }),
  resetStaffPassword: (id: string) =>
    api.post<{ account: StaffAccount; temporaryPassword: string }>(`/staff/accounts/${encodeURIComponent(id)}/reset-password`),
  updateStaff: (id: string, patch: { name?: string; phone?: string; role?: 'employee' | 'manager' }) =>
    api.patch<{ account: StaffAccount }>(`/staff/accounts/${encodeURIComponent(id)}`, patch),

  listPromotions: () => api.get<AdminPromotion[]>('/admin/promotions'),
  createPromotion: (input: PromotionInput) => api.post<AdminPromotion>('/admin/promotions', input),
  updatePromotion: (id: string, patch: Partial<PromotionInput> & { isActive?: boolean }) =>
    api.patch<AdminPromotion>(`/admin/promotions/${encodeURIComponent(id)}`, patch),
  deletePromotion: (id: string) => api.delete<void>(`/admin/promotions/${encodeURIComponent(id)}`),

  listRestaurants: () => api.get<{ items: PlatformRestaurant[] }>('/platform/restaurants').then(page => page.items),
  createRestaurant: (input: NewRestaurant) =>
    api.post<{ restaurant: { slug: string; name: string; status: string } }>('/platform/restaurants', input),
  setRestaurantStatus: (slug: string, status: 'active' | 'inactive') =>
    api.patch<{ slug: string; status: string }>(`/platform/restaurants/${encodeURIComponent(slug)}/status`, { status }),
};
