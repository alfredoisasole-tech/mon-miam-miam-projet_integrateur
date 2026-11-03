import { api } from '../models/http';

export type PaymentOperator = 'mpesa' | 'orange_money' | 'airtel_money' | 'africell_money';
export type PaymentOutcome = 'paid' | 'failed';

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

export interface SimulatePaymentResponse {
  paymentId: string;
  status: 'paid' | 'failed';
  orderStatus: string;
}

export const paymentApi = {
  // Démarrer le paiement (appelé depuis le panier par Gloirenk17)
  startPayment: async (orderId: string, payload: StartPaymentPayload): Promise<PaymentResponse> => {
    return api.post<PaymentResponse>(`/orders/${orderId}/pay`, payload);
  },

  // Simuler le résultat du paiement (pour la page de retour en dev/test)
  simulatePayment: async (paymentId: string, outcome: PaymentOutcome): Promise<SimulatePaymentResponse> => {
    return api.post<SimulatePaymentResponse>(`/payments/${paymentId}/simulate`, { outcome });
  }
};