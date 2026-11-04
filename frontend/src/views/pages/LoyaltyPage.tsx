import React from 'react';
import { Link } from 'react-router-dom';
import { movementLabel, useLoyalty } from '../../controllers/loyalty.ts';
import { useRestaurant } from '../../controllers/session.tsx';
import { formatPrice } from '../../models/format.ts';
import { Alert, Card, Spinner } from '../components/ui.tsx';
import { RequireRole } from '../components/RequireRole.tsx';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const LoyaltyPage: React.FC = () => {
  const { slug } = useRestaurant();
  const { balance, isLoading, error } = useLoyalty(slug);

  if (!slug) {
    return (
      <RequireRole allowedRoles={['student']}>
        <div className="loyalty-page" data-testid="loyalty-no-restaurant">
          <h2>Mes points de fidélité</h2>
          <Card>
            <p style={{ color: '#6b7280', margin: '1rem 0' }}>
              Choisissez un restaurant pour consulter vos points de fidélité.
            </p>
            <Link
              to="/"
              style={{
                display: 'inline-block',
                padding: '0.625rem 1.25rem',
                backgroundColor: 'var(--mm-color-primary, #cfbd97)',
                color: 'var(--mm-color-secondary, #000000)',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Voir les restaurants
            </Link>
          </Card>
        </div>
      </RequireRole>
    );
  }

  return (
    <RequireRole allowedRoles={['student']}>
      <div className="loyalty-page" data-testid="loyalty-page">
        <header style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.875rem', margin: '0 0 0.5rem' }}>
            Vos points Miam Club
          </h2>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Les points sont calculés restaurant par restaurant
            {balance?.rules ? ` : ${formatPrice(balance.rules.spendPerPointFc)} payés = 1 point.` : '.'}
          </p>
        </header>

        {error && (
          <div style={{ marginBottom: '1.5rem' }}>
            <Alert kind="error">{error}</Alert>
          </div>
        )}

        {isLoading ? (
          <Spinner label="Chargement de vos points..." />
        ) : balance ? (
          <>
            {/* Grille des soldes */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem',
              }}
            >
              {/* Carte Solde */}
              <Card>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#6b7280' }}>
                  Solde chez {balance.restaurant.name}
                </h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0' }} data-testid="available-points">
                  {balance.availablePoints}
                </div>
                <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
                  points · soit {formatPrice(Math.floor(balance.availablePoints / (balance.rules?.pointsForReward || 15)) * (balance.rules?.rewardValueFc || 3000))} de réduction possible
                </p>
                {balance.remainderFc > 0 && (
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                    Dépenses en attente : {formatPrice(balance.remainderFc)} / {formatPrice(balance.rules?.spendPerPointFc || 3000)} pour le prochain point
                  </p>
                )}
              </Card>

              {/* Carte Palier de réduction */}
              <Card>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#6b7280' }}>
                  Palier de réduction
                </h3>
                <div style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0.5rem 0' }}>
                  {balance.rules?.pointsForReward ?? 15} points = {formatPrice(balance.rules?.rewardValueFc ?? 3000)}
                </div>

                {balance.availablePoints >= (balance.rules?.pointsForReward ?? 15) ? (
                  <p style={{ margin: 0, color: '#16a34a', fontWeight: 600 }} data-testid="reward-available">
                    Vous avez {balance.availablePoints} points : {Math.floor(balance.availablePoints / (balance.rules?.pointsForReward ?? 15))} réduction(s) disponible(s).
                  </p>
                ) : (
                  <p style={{ margin: 0, color: '#4b5563' }} data-testid="points-missing">
                    Il vous manque {(balance.rules?.pointsForReward ?? 15) - balance.availablePoints} points pour une réduction de {formatPrice(balance.rules?.rewardValueFc ?? 3000)}.
                  </p>
                )}
              </Card>
            </div>

            {/* Historique des mouvements */}
            <section aria-labelledby="movements-heading">
              <h3 id="movements-heading" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
                Historique des mouvements
              </h3>

              {balance.movements.length === 0 ? (
                <Card>
                  <p style={{ color: '#6b7280', textAlign: 'center', margin: '2rem 0' }} data-testid="empty-movements">
                    Vous n'avez pas encore cumulé de points chez {balance.restaurant.name}.
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
                        <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Motif</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balance.movements.map((mov, index) => (
                        <tr key={`${mov.createdAt}-${mov.kind}-${mov.orderId ?? index}-${index}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>
                            {formatDate(mov.createdAt)}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>{movementLabel(mov)}</td>
                          <td
                            style={{
                              padding: '0.75rem 1rem',
                              textAlign: 'right',
                              fontWeight: 'bold',
                              color: mov.points > 0 ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {mov.points > 0 ? `+${mov.points}` : mov.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </RequireRole>
  );
};

