import { api } from '../models/http.ts';

export type ClaimKind = 'order' | 'points' | 'other';
export type ClaimStatus = 'open' | 'pending_validation' | 'resolved';
export type Decision = 'accept' | 'refuse';

export const CLAIM_KINDS: Array<[ClaimKind, string]> = [['order', 'Une commande'], ['points', 'Mes points'], ['other', 'Autre']];
export const KIND_LABEL: Record<ClaimKind, string> = { order: 'Commande', points: 'Points', other: 'Autre' };

export interface StudentClaim {
  id: string;
  restaurant: { slug: string; name: string };
  orderId: string | null;
  kind: ClaimKind;
  subject: string;
  message: string;
  requestedPoints: number | null;
  /** « ouverte », « en cours d’examen » ou « traitée ». */
  status: string;
  decision?: Decision | null;
  response?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface StaffClaim {
  id: string;
  restaurant: { slug: string; name: string };
  student: { id: string; name: string; phone: string };
  orderId: string | null;
  kind: ClaimKind;
  subject: string;
  message: string;
  requestedPoints: number | null;
  status: ClaimStatus;
  proposedDecision: Decision | null;
  proposedResponse: string | null;
  proposedBy: string | null;
  decision: Decision | null;
  response: string | null;
  managerNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface CreateClaim {
  restaurant: string;
  kind: ClaimKind;
  orderId?: string;
  subject: string;
  message: string;
  requestedPoints?: number;
}

export const claimsApi = {
  create: (input: CreateClaim) => api.post<StudentClaim>('/claims', input),
  list: () => api.get<StudentClaim[]>('/claims'),
  staffList: (status?: ClaimStatus) => api.get<StaffClaim[]>(`/staff/claims${status ? `?status=${status}` : ''}`),
  propose: (id: string, decision: Decision, response: string) =>
    api.post<StaffClaim>(`/staff/claims/${encodeURIComponent(id)}/propose`, { decision, response }),
  validate: (id: string, pointsGranted?: number) =>
    api.post<StaffClaim>(`/staff/claims/${encodeURIComponent(id)}/validate`, pointsGranted === undefined ? {} : { pointsGranted }),
  reject: (id: string, note: string) => api.post<StaffClaim>(`/staff/claims/${encodeURIComponent(id)}/reject`, { note }),
};
