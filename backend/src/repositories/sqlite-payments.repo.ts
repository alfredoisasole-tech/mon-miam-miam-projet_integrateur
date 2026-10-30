import { randomUUID } from 'node:crypto';
import type { Database } from '../db/database.ts';
import type {
  ApplyPaymentNotificationResult,
  PaymentFinalStatus,
  PaymentOperator,
  PaymentRecord,
  PaymentRecordStatus,
  PaymentsRepository,
  StartPaymentResult,
} from '../domain/payments.ts';
import type { OrderStatus, PaymentStatus } from '../domain/orders.ts';

interface OrderForPaymentRow {
  id: string;
  restaurant_id: string;
  status: OrderStatus;
  payment_method: 'cash' | 'mobile_money';
  payment_status: PaymentStatus;
  total_fc: number;
}

interface PaymentRow {
  id: string;
  restaurant_id: string;
  order_id: string;
  operator: PaymentOperator;
  phone: string;
  amount_fc: number;
  status: PaymentRecordStatus;
  provider_ref: string | null;
  created_at: string;
  updated_at: string;
}

interface PaymentAndOrderRow extends PaymentRow {
  order_status: OrderStatus;
  order_payment_status: PaymentStatus;
}

function mapPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    orderId: row.order_id,
    operator: row.operator,
    phone: row.phone,
    amountFc: row.amount_fc,
    status: row.status,
    providerRef: row.provider_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqlitePaymentsRepository implements PaymentsRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async startPayment(input: {
    userId: string;
    orderId: string;
    paymentId: string;
    operator: PaymentOperator;
    phone: string;
    at: string;
  }): Promise<StartPaymentResult> {
    return this.db.transaction(() => {
      const order = this.db.get<OrderForPaymentRow>(`
        SELECT o.id, o.restaurant_id, o.status, o.payment_method, o.payment_status, o.total_fc
        FROM orders o
        WHERE o.id = ? AND o.user_id = ?
          AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = o.user_id AND m.restaurant_id = o.restaurant_id)
      `, [input.orderId, input.userId]);
      if (!order) return { kind: 'not_found' } as const;

      if (order.status === 'pending' && order.payment_method === 'mobile_money' && order.payment_status === 'pending') {
        const existing = this.db.get<PaymentRow>(`
          SELECT id, restaurant_id, order_id, operator, phone, amount_fc, status, provider_ref, created_at, updated_at
          FROM payments
          WHERE order_id = ? AND restaurant_id = ? AND status = 'pending'
          ORDER BY created_at LIMIT 1
        `, [order.id, order.restaurant_id]);
        if (existing) return { kind: 'pending', created: false, payment: mapPayment(existing) } as const;
        return { kind: 'not_payable' } as const;
      }

      if (order.status !== 'pending' || order.payment_method !== 'mobile_money'
        || order.payment_status !== 'unpaid' || order.total_fc <= 0) {
        return { kind: 'not_payable' } as const;
      }

      this.db.run(`INSERT INTO payments (
        id, restaurant_id, order_id, operator, phone, amount_fc, status, provider_ref, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`, [
        input.paymentId, order.restaurant_id, order.id, input.operator, input.phone, order.total_fc, input.at, input.at,
      ]);
      const result = this.db.run(`UPDATE orders SET payment_status = 'pending', updated_at = ?
        WHERE id = ? AND restaurant_id = ? AND user_id = ? AND status = 'pending'
          AND payment_method = 'mobile_money' AND payment_status = 'unpaid'`,
      [input.at, order.id, order.restaurant_id, input.userId]);
      if (Number(result.changes) !== 1) throw new Error('La commande a changé pendant le démarrage du paiement.');

      const payment = this.db.get<PaymentRow>(`
        SELECT id, restaurant_id, order_id, operator, phone, amount_fc, status, provider_ref, created_at, updated_at
        FROM payments WHERE id = ? AND restaurant_id = ? AND order_id = ?
      `, [input.paymentId, order.restaurant_id, order.id]);
      if (!payment) throw new Error('Le paiement créé est introuvable dans son restaurant.');
      return { kind: 'pending', created: true, payment: mapPayment(payment) } as const;
    });
  }

  async failPaymentStart(paymentId: string, at: string): Promise<void> {
    this.db.transaction(() => {
      const payment = this.db.get<PaymentAndOrderRow>(`
        SELECT p.id, p.restaurant_id, p.order_id, p.operator, p.phone, p.amount_fc, p.status, p.provider_ref,
          p.created_at, p.updated_at, o.status AS order_status, o.payment_status AS order_payment_status
        FROM payments p JOIN orders o ON o.id = p.order_id AND o.restaurant_id = p.restaurant_id
        WHERE p.id = ?
      `, [paymentId]);
      if (!payment || payment.status !== 'pending' || payment.order_payment_status !== 'pending') return;

      this.db.run(`UPDATE payments SET status = 'failed', updated_at = ?
        WHERE id = ? AND restaurant_id = ? AND order_id = ? AND status = 'pending'`,
      [at, paymentId, payment.restaurant_id, payment.order_id]);
      if (payment.order_status === 'pending') {
        this.db.run(`UPDATE orders SET payment_status = 'failed', updated_at = ?
          WHERE id = ? AND restaurant_id = ? AND status = 'pending' AND payment_status = 'pending'`,
        [at, payment.order_id, payment.restaurant_id]);
      }
    });
  }

  async applyNotification(input: {
    paymentId: string;
    status: PaymentFinalStatus;
    providerRef: string;
    at: string;
  }): Promise<ApplyPaymentNotificationResult> {
    return this.db.transaction(() => {
      const payment = this.db.get<PaymentAndOrderRow>(`
        SELECT p.id, p.restaurant_id, p.order_id, p.operator, p.phone, p.amount_fc, p.status, p.provider_ref,
          p.created_at, p.updated_at, o.status AS order_status, o.payment_status AS order_payment_status
        FROM payments p JOIN orders o ON o.id = p.order_id AND o.restaurant_id = p.restaurant_id
        WHERE p.id = ?
      `, [input.paymentId]);
      if (!payment) return { kind: 'not_found' } as const;

      if (payment.status === input.status) {
        return { kind: 'replayed', paymentStatus: payment.status, orderStatus: payment.order_status } as const;
      }
      if (payment.status !== 'pending' || payment.order_status !== 'pending' || payment.order_payment_status !== 'pending') {
        return { kind: 'already_finalized' } as const;
      }

      const paymentUpdate = this.db.run(`UPDATE payments SET status = ?, provider_ref = ?, updated_at = ?
        WHERE id = ? AND restaurant_id = ? AND order_id = ? AND status = 'pending'`,
      [input.status, input.providerRef, input.at, payment.id, payment.restaurant_id, payment.order_id]);
      if (Number(paymentUpdate.changes) !== 1) throw new Error('Le paiement a changé pendant la confirmation.');

      const nextOrderStatus: OrderStatus = input.status === 'paid' ? 'confirmed' : 'pending';
      const orderUpdate = this.db.run(`UPDATE orders SET payment_status = ?, status = ?, updated_at = ?
        WHERE id = ? AND restaurant_id = ? AND status = 'pending' AND payment_status = 'pending'`,
      [input.status, nextOrderStatus, input.at, payment.order_id, payment.restaurant_id]);
      if (Number(orderUpdate.changes) !== 1) throw new Error('La commande a changé pendant la confirmation du paiement.');

      if (input.status === 'paid') {
        this.db.run(`INSERT INTO order_events (id, order_id, status, created_at)
          VALUES (?, ?, 'confirmed', ?)`, [randomUUID(), payment.order_id, input.at]);
      }
      return { kind: 'applied', paymentStatus: input.status, orderStatus: nextOrderStatus } as const;
    });
  }
}
