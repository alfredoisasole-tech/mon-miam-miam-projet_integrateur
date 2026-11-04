import { api } from '../models/http';

export type PaymentOperator = 'mpesa' | 'orange_money' | 'airtel_money' | 'africell_money';

export interface StartPaymentPayload {
  operator: PaymentOperator;
  phone: string;
}

export interface PaymentResponse {
  paymentId: string;
  status: 'pending' | 'paid' | 'failed';
  amountFc: number;
  redirectUrl: string;
}

export const paymentApi = {
  // Démarrer le paiement (appelé depuis le panier par Gloirenk17)
  startPayment: async (orderId: string, payload: StartPaymentPayload): Promise<PaymentResponse> => {
    return api.post<PaymentResponse>(`/orders/${orderId}/pay`, payload);
  },

  // Fournisseur de simulation (essais et démonstrations) : l'API refuse cette route en production ou avec Easypay.
  simulate: async (paymentId: string, outcome: 'paid' | 'failed'): Promise<{ paymentId: string; status: 'paid' | 'failed' }> => {
    return api.post(`/payments/${encodeURIComponent(paymentId)}/simulate`, { outcome });
  },
};
