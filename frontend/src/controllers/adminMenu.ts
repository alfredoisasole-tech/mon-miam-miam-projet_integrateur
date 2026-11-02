import { api } from '../models/http';
import type { MenuDish } from './useMenu';

export interface CreateDishPayload {
  name: string;
  description: string;
  priceFc: number;
  category: 'plat' | 'boisson' | 'dessert' | 'snack';
  isDaily: boolean;
  isAvailable: boolean;
}

export interface UpdateDishPayload {
  name?: string;
  description?: string;
  priceFc?: number;
  category?: 'plat' | 'boisson' | 'dessert' | 'snack';
  isDaily?: boolean;
  isAvailable?: boolean;
}

export interface StaffUpdatePayload {
  isAvailable?: boolean;
  isDaily?: boolean;
}

export const adminMenuApi = {
  // Récupérer tous les plats du restaurant (y compris épuisés)
  getStaffMenu: async (): Promise<MenuDish[]> => {
    return api.get<MenuDish[]>('/api/staff/menu');
  },

  // Créer un plat (admin seulement)
  createDish: async (payload: CreateDishPayload): Promise<MenuDish> => {
    return api.post<MenuDish>('/api/admin/menu', payload);
  },

  // Modifier un plat (admin seulement)
  updateDish: async (dishId: string, payload: UpdateDishPayload): Promise<MenuDish> => {
    return api.patch<MenuDish>(`/api/admin/menu/${dishId}`, payload);
  },

  // Supprimer un plat (admin seulement)
  deleteDish: async (dishId: string): Promise<void> => {
    return api.delete<void>(`/api/admin/menu/${dishId}`);
  },

  // Mise à jour rapide (employé : seulement disponibilité et plat du jour)
  staffUpdate: async (dishId: string, payload: StaffUpdatePayload): Promise<MenuDish> => {
    return api.patch<MenuDish>(`/api/staff/menu/${dishId}`, payload);
  },
};
