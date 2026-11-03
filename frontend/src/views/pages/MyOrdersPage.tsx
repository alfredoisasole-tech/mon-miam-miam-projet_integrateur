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
      <div className="my-orders-page" data-testid="my-orders-page">
        <h2>Mes Commandes</h2>

        {isLoading && <p>Chargement de vos commandes...</p>}
        
        {error && <p role="alert" data-testid="error-message">{error}</p>}

        {!isLoading && !error && orders.length === 0 && (
          <p data-testid="no-orders">Vous n'avez pas encore passé de commande.</p>
        )}

        {!isLoading && !error && orders.length > 0 && (
          <ul className="orders-list" data-testid="orders-list">
            {orders.map((order) => (
              <li key={order.id} className="order-card" data-testid={`order-${order.id}`}>
                <div className="order-header">
                  <span className="order-restaurant">{order.restaurantName}</span>
                  <span 
                    className="order-status" 
                    style={{ color: getStatusColor(order.status), fontWeight: 'bold' }}
                    data-testid={`status-${order.id}`}
                  >
                    {getStatusLabel(order.status)}
                  </span>
                </div>
                
                <div className="order-date">
                  Commandé le {formatDate(order.createdAt)}
                </div>

                <ul className="order-items">
                  {order.items.map((item) => (
                    <li key={item.id} className="order-item">
                      {item.quantity}x {item.name} 
                      <span className="item-price">{item.unitPriceFc} FC</span>
                    </li>
                  ))}
                </ul>

                <div className="order-total">
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