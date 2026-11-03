import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../models/http.ts';

export type StaffOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

export interface StaffOrderItem {
  menuItemId: string;
  name: string;
  category?: string;
  unitPriceFc: number;
  quantity: number;
  lineTotalFc: number;
}

export interface StaffOrder {
  id: string;
  orderNumber: string;
  type: 'dine_in' | 'delivery';
  status: StaffOrderStatus;
  paymentMethod: 'cash' | 'mobile_money';
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refund_due';
  items: StaffOrderItem[];
  subtotalFc: number;
  discountFc: number;
  deliveryFeeFc: number;
  totalFc: number;
  arrivalTime: string | null;
  delivery: {
    commune: string;
    quartier: string | null;
    address: string | null;
    landmark: string | null;
    phone: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface StaffOrdersResponse {
  items: StaffOrder[];
}

export function useStaffOrders(refreshIntervalMs = 5000) {
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<StaffOrdersResponse | StaffOrder[]>('/staff/orders');
      if (!isMountedRef.current) return;
      const list = Array.isArray(res) ? res : res.items ?? [];
      setOrders(list);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Impossible de charger les commandes.';
      setError(message);
    } finally {
      if (isMountedRef.current && !quiet) {
        setIsLoading(false);
      }
    }
  }, []);

  const updateStatus = useCallback(async (orderId: string, nextStatus: StaffOrderStatus) => {
    setActionError(null);
    try {
      const updated = await api.patch<StaffOrder>(`/staff/orders/${orderId}/status`, {
        status: nextStatus,
      });
      if (!isMountedRef.current) return;
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, ...updated, status: nextStatus } : ord)),
      );
      return updated;
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Impossible de mettre à jour le statut.';
      setActionError(message);
      throw err;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadOrders();

    if (refreshIntervalMs > 0) {
      const timer = setInterval(() => {
        void loadOrders(true);
      }, refreshIntervalMs);
      return () => {
        isMountedRef.current = false;
        clearInterval(timer);
      };
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [loadOrders, refreshIntervalMs]);

  return {
    orders,
    isLoading,
    error,
    actionError,
    updateStatus,
    reload: loadOrders,
  };
}

