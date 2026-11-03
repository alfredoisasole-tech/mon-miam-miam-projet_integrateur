import React, { useMemo, useState } from 'react';
import { useStaffOrders, type StaffOrder, type StaffOrderStatus } from '../../controllers/staffOrders.ts';
import { formatPrice } from '../../models/format.ts';
import { Alert, Badge, Card, Spinner } from '../components/ui.tsx';

type TabKey = 'active' | 'completed' | 'cancelled';

const STATUS_LABELS: Record<StaffOrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête',
  out_for_delivery: 'En livraison',
  completed: 'Terminée',
  cancelled: 'Annulée',
};

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Non payé',
  pending: 'En attente de paiement',
  paid: 'Confirmé',
  failed: 'Échoué',
  refund_due: 'Remboursement dû',
};

export const StaffOrdersPage: React.FC = () => {
  const { orders, isLoading, error, actionError, updateStatus, reload } = useStaffOrders();
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'pending' ||
          o.status === 'confirmed' ||
          o.status === 'preparing' ||
          o.status === 'ready' ||
          o.status === 'out_for_delivery',
      ),
    [orders],
  );

  const completedOrders = useMemo(() => orders.filter((o) => o.status === 'completed'), [orders]);
  const cancelledOrders = useMemo(() => orders.filter((o) => o.status === 'cancelled'), [orders]);

  const displayedOrders = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return activeOrders;
      case 'completed':
        return completedOrders;
      case 'cancelled':
        return cancelledOrders;
    }
  }, [activeTab, activeOrders, completedOrders, cancelledOrders]);

  const handleAction = async (orderId: string, nextStatus: StaffOrderStatus) => {
    setUpdatingId(orderId);
    try {
      await updateStatus(orderId, nextStatus);
    } catch {
      // Handled by hook actionError
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="staff-orders-page" data-testid="staff-orders-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.5rem' }}>Les commandes du service</h2>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Gestion en direct des commandes du restaurant.
          </p>
        </div>
        <button
          type="button"
          onClick={() => reload()}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
          data-testid="refresh-button"
        >
          Actualiser
        </button>
      </div>

      {/* Onglets */}
      <div
        role="tablist"
        aria-label="Filtrer les commandes"
        style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e5e7eb', marginBottom: '1.5rem' }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'active'}
          onClick={() => setActiveTab('active')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'active' ? '3px solid var(--mm-color-primary, #cfbd97)' : '3px solid transparent',
            fontWeight: activeTab === 'active' ? 'bold' : 'normal',
            cursor: 'pointer',
          }}
          data-testid="tab-active"
        >
          En cours ({activeOrders.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'completed'}
          onClick={() => setActiveTab('completed')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'completed' ? '3px solid var(--mm-color-primary, #cfbd97)' : '3px solid transparent',
            fontWeight: activeTab === 'completed' ? 'bold' : 'normal',
            cursor: 'pointer',
          }}
          data-testid="tab-completed"
        >
          Terminées ({completedOrders.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cancelled'}
          onClick={() => setActiveTab('cancelled')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'cancelled' ? '3px solid var(--mm-color-primary, #cfbd97)' : '3px solid transparent',
            fontWeight: activeTab === 'cancelled' ? 'bold' : 'normal',
            cursor: 'pointer',
          }}
          data-testid="tab-cancelled"
        >
          Annulées ({cancelledOrders.length})
        </button>
      </div>

      {actionError && (
        <div style={{ marginBottom: '1rem' }}>
          <Alert kind="error">{actionError}</Alert>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '1rem' }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {isLoading && orders.length === 0 ? (
        <Spinner label="Chargement des commandes..." />
      ) : displayedOrders.length === 0 ? (
        <Card>
          <p style={{ color: '#6b7280', textAlign: 'center', margin: '2rem 0' }}>
            Aucune commande dans cet onglet.
          </p>
        </Card>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Numéro</th>
                <th style={{ padding: '0.75rem 1rem' }}>Service</th>
                <th style={{ padding: '0.75rem 1rem' }}>Articles</th>
                <th style={{ padding: '0.75rem 1rem' }}>Total</th>
                <th style={{ padding: '0.75rem 1rem' }}>Paiement</th>
                <th style={{ padding: '0.75rem 1rem' }}>Statut</th>
                <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.map((order: StaffOrder) => {
                const isBusy = updatingId === order.id;

                return (
                  <tr
                    key={order.id}
                    data-testid={`order-row-${order.id}`}
                    style={{ borderBottom: '1px solid #e5e7eb' }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                      {order.orderNumber}
                    </td>

                    <td style={{ padding: '0.75rem 1rem' }}>
                      {order.type === 'dine_in' ? 'Sur place' : 'Livraison'}
                      {order.arrivalTime && (
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                          Arrivée : {new Date(order.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      {order.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                    </td>

                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                      {formatPrice(order.totalFc)}
                    </td>

                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Badge kind={order.paymentStatus === 'paid' ? 'success' : 'neutral'}>
                        {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                      </Badge>
                    </td>

                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Badge kind={order.status === 'completed' ? 'success' : order.status === 'cancelled' ? 'neutral' : 'info'}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </td>

                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {order.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAction(order.id, 'confirmed')}
                              style={{
                                padding: '0.375rem 0.75rem',
                                backgroundColor: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                              data-testid={`btn-confirm-${order.id}`}
                            >
                              Confirmer
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAction(order.id, 'cancelled')}
                              style={{
                                padding: '0.375rem 0.75rem',
                                backgroundColor: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                              data-testid={`btn-cancel-${order.id}`}
                            >
                              Annuler
                            </button>
                          </>
                        )}

                        {order.status === 'confirmed' && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAction(order.id, 'preparing')}
                              style={{
                                padding: '0.375rem 0.75rem',
                                backgroundColor: '#3b82f6',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                              data-testid={`btn-preparing-${order.id}`}
                            >
                              En préparation
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAction(order.id, 'cancelled')}
                              style={{
                                padding: '0.375rem 0.75rem',
                                backgroundColor: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                              data-testid={`btn-cancel-${order.id}`}
                            >
                              Annuler
                            </button>
                          </>
                        )}

                        {order.status === 'preparing' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleAction(order.id, 'ready')}
                            style={{
                              padding: '0.375rem 0.75rem',
                              backgroundColor: '#8b5cf6',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                            data-testid={`btn-ready-${order.id}`}
                          >
                            Prête
                          </button>
                        )}

                        {order.status === 'ready' && (
                          <>
                            {order.type === 'delivery' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(order.id, 'out_for_delivery')}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  backgroundColor: '#f59e0b',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '0.25rem',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                }}
                                data-testid={`btn-delivery-${order.id}`}
                              >
                                En livraison
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAction(order.id, 'completed')}
                              style={{
                                padding: '0.375rem 0.75rem',
                                backgroundColor: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: 'pointer',
                                fontWeight: 500,
                              }}
                              data-testid={`btn-complete-${order.id}`}
                            >
                              Terminée
                            </button>
                          </>
                        )}

                        {order.status === 'out_for_delivery' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleAction(order.id, 'completed')}
                            style={{
                              padding: '0.375rem 0.75rem',
                              backgroundColor: '#10b981',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                            data-testid={`btn-complete-${order.id}`}
                          >
                            Terminée
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
