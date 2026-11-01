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
  register(slug: string, input: RegisterInput): Promise<RegisterResponse> {
    // D-5 : POST /api/restaurants/:slug/auth/register
    return api.post<RegisterResponse>(`/restaurants/${encodeURIComponent(slug)}/auth/register`, input);
  },
};