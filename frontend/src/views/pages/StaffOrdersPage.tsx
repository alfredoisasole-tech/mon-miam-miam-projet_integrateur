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
    <div className="staff-orders-page" data-testid="staff-orders-page" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--mm-line)', paddingBottom: '1.25rem', marginBottom: '2rem' }}>
        <div>
          <div className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.25rem' }}>Espace Cuisine & Service</div>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.85rem' }}>Les commandes du service</h2>
          <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>
            Gestion en direct des commandes du restaurant.
          </p>
        </div>
        <button
          type="button"
          onClick={() => reload()}
          className="btn btn-outline"
          data-testid="refresh-button"
          style={{ gap: '0.5rem' }}
        >
          <span>↻</span> Actualiser
        </button>
      </div>

      {/* Onglets */}
      <div
        role="tablist"
        aria-label="Filtrer les commandes"
        className="tabs"
        style={{ marginBottom: '2rem' }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'active'}
          onClick={() => setActiveTab('active')}
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          data-testid="tab-active"
        >
          En cours ({activeOrders.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'completed'}
          onClick={() => setActiveTab('completed')}
          className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
          data-testid="tab-completed"
        >
          Terminées ({completedOrders.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cancelled'}
          onClick={() => setActiveTab('cancelled')}
          className={`tab ${activeTab === 'cancelled' ? 'active' : ''}`}
          data-testid="tab-cancelled"
        >
          Annulées ({cancelledOrders.length})
        </button>
      </div>

      {actionError && (
        <div style={{ marginBottom: '1.5rem' }}>
          <Alert kind="error">{actionError}</Alert>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '1.5rem' }}>
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {isLoading && orders.length === 0 ? (
        <Spinner label="Chargement des commandes..." />
      ) : displayedOrders.length === 0 ? (
        <div className="empty">
          <p style={{ color: 'var(--mm-muted)', margin: 0, fontSize: '1.05rem' }}>
            Aucune commande dans cet onglet.
          </p>
        </div>
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--mm-line)', color: 'var(--mm-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Numéro</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Service</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Articles</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Total</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Paiement</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Statut</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedOrders.map((order: StaffOrder) => {
                  const isBusy = updatingId === order.id;

                  return (
                    <tr
                      key={order.id}
                      data-testid={`order-row-${order.id}`}
                      style={{ borderBottom: '1px solid var(--mm-surface-subtle)', transition: 'background-color 0.15s ease' }}
                    >
                      <td style={{ padding: '1rem', fontWeight: 700, fontSize: '0.95rem', color: 'var(--mm-text)' }}>
                        {order.orderNumber}
                      </td>

                      <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                        <div style={{ fontWeight: 600 }}>{order.type === 'dine_in' ? 'Sur place' : 'Livraison'}</div>
                        {order.arrivalTime && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--mm-muted)' }}>
                            Arrivée : {new Date(order.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {order.delivery?.commune && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--mm-muted)' }}>
                            {order.delivery.commune}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '1rem', fontSize: '0.9rem', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 500 }}>
                          {order.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                        </div>
                      </td>

                      <td style={{ padding: '1rem', fontWeight: 700, fontSize: '1rem' }}>
                        {formatPrice(order.totalFc)}
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <Badge kind={order.paymentStatus === 'paid' ? 'success' : 'neutral'}>
                          {PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
                        </Badge>
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <Badge kind={order.status === 'completed' ? 'success' : order.status === 'cancelled' ? 'neutral' : 'info'}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </Badge>
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {order.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(order.id, 'confirmed')}
                                className="btn btn-primary"
                                style={{
                                  padding: '0.35rem 0.85rem',
                                  fontSize: '0.85rem',
                                  minHeight: '34px',
                                  borderRadius: 'var(--mm-radius-sm)',
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
                                  padding: '0.35rem 0.85rem',
                                  fontSize: '0.85rem',
                                  minHeight: '34px',
                                  borderRadius: 'var(--mm-radius-sm)',
                                  background: 'var(--mm-danger-bg)',
                                  color: 'var(--mm-danger)',
                                  border: '1px solid var(--mm-danger-border)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
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
                                  padding: '0.35rem 0.85rem',
                                  fontSize: '0.85rem',
                                  minHeight: '34px',
                                  borderRadius: 'var(--mm-radius-sm)',
                                  background: 'var(--mm-info-bg)',
                                  color: 'var(--mm-info)',
                                  border: '1px solid var(--mm-info-border)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
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
                                  padding: '0.35rem 0.85rem',
                                  fontSize: '0.85rem',
                                  minHeight: '34px',
                                  borderRadius: 'var(--mm-radius-sm)',
                                  background: 'var(--mm-danger-bg)',
                                  color: 'var(--mm-danger)',
                                  border: '1px solid var(--mm-danger-border)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
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
                                padding: '0.35rem 0.85rem',
                                fontSize: '0.85rem',
                                minHeight: '34px',
                                borderRadius: 'var(--mm-radius-sm)',
                                background: 'var(--mm-ready-bg)',
                                color: 'var(--mm-ready)',
                                border: '1px solid var(--mm-ready-border)',
                                fontWeight: 600,
                                cursor: 'pointer',
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
                                    padding: '0.35rem 0.85rem',
                                    fontSize: '0.85rem',
                                    minHeight: '34px',
                                    borderRadius: 'var(--mm-radius-sm)',
                                    background: 'var(--mm-pending-bg)',
                                    color: 'var(--mm-pending)',
                                    border: '1px solid var(--mm-pending-border)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
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
                                  padding: '0.35rem 0.85rem',
                                  fontSize: '0.85rem',
                                  minHeight: '34px',
                                  borderRadius: 'var(--mm-radius-sm)',
                                  background: 'var(--mm-ok-bg)',
                                  color: 'var(--mm-ok)',
                                  border: '1px solid var(--mm-ok-border)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
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
                                padding: '0.35rem 0.85rem',
                                fontSize: '0.85rem',
                                minHeight: '34px',
                                borderRadius: 'var(--mm-radius-sm)',
                                background: 'var(--mm-ok-bg)',
                                color: 'var(--mm-ok)',
                                border: '1px solid var(--mm-ok-border)',
                                fontWeight: 600,
                                cursor: 'pointer',
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
        </Card>
      )}
    </div>
  );
};
