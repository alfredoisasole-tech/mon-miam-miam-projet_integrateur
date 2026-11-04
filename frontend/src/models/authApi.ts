import { api } from './http';

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  deliveryAddress?: string; 
  password: string;
  confirmPassword: string; 
  acceptTerms: boolean;
  referralCode?: string;
}

export interface RegisterResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'student';
  };
}

export const authApi = {
  register(input: RegisterInput): Promise<RegisterResponse> {
    // Le compte appartient à la plateforme : POST /api/auth/register, sans restaurant.
    return api.post<RegisterResponse>('/auth/register', input);
  },
};