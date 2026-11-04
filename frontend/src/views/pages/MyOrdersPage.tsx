import React from 'react';
import { useMyOrders, type Order } from '../../controllers/orders';
import { RequireRole } from '../components/RequireRole';

// Fonction utilitaire pour formater la date
const formatDate = (isoDate: string) => {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Fonction utilitaire pour traduire le statut
const getStatusLabel = (status: Order['status']) => {
  const labels: Record<Order['status'], string> = {
    pending: 'En attente',
    preparing: 'En préparation',
    ready: 'Prête à récupérer',
    delivered: 'Livrée',
    cancelled: 'Annulée',
  };
  return labels[status];
};

// Fonction utilitaire pour la couleur du statut
const getStatusColor = (status: Order['status']) => {
  const colors: Record<Order['status'], string> = {
    pending: '#f59e0b', // orange
    preparing: '#3b82f6', // bleu
    ready: '#10b981', // vert
    delivered: '#6b7280', // gris
    cancelled: '#ef4444', // rouge
  };
  return colors[status];
};

export const MyOrdersPage: React.FC = () => {
  const { data: orders, isLoading, error } = useMyOrders();

  return (
    <RequireRole allowedRoles={['student']}>
      <div className="my-orders-page" data-testid="my-orders-page" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <header style={{ borderBottom: '1px solid var(--mm-line)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.85rem', margin: '0 0 0.25rem' }}>Mes Commandes</h2>
          <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>
            Retrouvez l'historique et le statut en temps réel de vos commandes sur le campus.
          </p>
        </header>

        {isLoading && <p className="muted">Chargement de vos commandes...</p>}
        
        {error && <p className="alert alert-error" role="alert" data-testid="error-message">{error}</p>}

        {!isLoading && !error && orders.length === 0 && (
          <div className="empty">
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
            <p data-testid="no-orders" style={{ color: 'var(--mm-muted)', margin: 0, fontSize: '1.05rem' }}>
              Vous n'avez pas encore passé de commande.
            </p>
          </div>
        )}

        {!isLoading && !error && orders.length > 0 && (
          <ul className="orders-list" data-testid="orders-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '1.5rem' }}>
            {orders.map((order) => (
              <li key={order.id} className="order-card card" data-testid={`order-${order.id}`} style={{ padding: '1.5rem' }}>
                <div className="order-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span className="order-restaurant" style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--mm-text)' }}>
                    {order.restaurantName}
                  </span>
                  <span 
                    className="order-status badge" 
                    style={{
                      color: getStatusColor(order.status),
                      borderColor: getStatusColor(order.status),
                      backgroundColor: 'var(--mm-surface-subtle)',
                      fontWeight: 700,
                      padding: '0.25rem 0.75rem',
                    }}
                    data-testid={`status-${order.id}`}
                  >
                    {getStatusLabel(order.status)}
                  </span>
                </div>
                
                <div className="order-date muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                  Commandé le {formatDate(order.createdAt)}
                </div>

                <ul className="order-items" style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem', borderTop: '1px solid var(--mm-surface-subtle)', borderBottom: '1px solid var(--mm-surface-subtle)', paddingBlock: '0.75rem' }}>
                  {order.items.map((item) => (
                    <li key={item.id} className="order-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', fontSize: '0.95rem' }}>
                      <span>{item.quantity}x {item.name}</span>
                      <span className="item-price muted">{item.unitPriceFc} FC</span>
                    </li>
                  ))}
                </ul>

                <div className="order-total" style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '1.1rem' }}>
                  <strong>Total : {order.totalFc} FC</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RequireRole>
  );
};