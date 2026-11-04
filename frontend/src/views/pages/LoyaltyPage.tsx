import React from 'react';
import { Link } from 'react-router-dom';
import { useLoyalty } from '../../controllers/loyalty.ts';
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
        <div className="loyalty-page" data-testid="loyalty-no-restaurant" style={{ maxWidth: '580px', margin: '2rem auto' }}>
          <h2 style={{ marginBottom: '1.25rem' }}>Mes points de fidélité</h2>
          <div className="empty">
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⭐</div>
            <p style={{ color: 'var(--mm-muted)', fontSize: '1.05rem', marginBottom: '1.5rem' }}>
              Choisissez un restaurant pour consulter vos points de fidélité.
            </p>
            <Link
              to="/"
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.5rem' }}
            >
              Voir les restaurants
            </Link>
          </div>
        </div>
      </RequireRole>
    );
  }

  return (
    <RequireRole allowedRoles={['student']}>
      <div className="loyalty-page" data-testid="loyalty-page" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <header style={{ borderBottom: '1px solid var(--mm-line)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="eyebrow" style={{ color: 'var(--mm-accent)' }}>Programme Privilège</span>
          </div>
          <h2 style={{ fontSize: '1.85rem', margin: '0 0 0.5rem' }}>
            Vos points Miam Club
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>
            Les points sont calculés restaurant par restaurant : 3 000 FC payés = 1 point.
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
            {/* Grille des soldes & Programme */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem',
              }}
            >
              {/* Carte Solde Principal */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--mm-muted)' }}>
                    Solde chez {balance.restaurant.name}
                  </h3>
                  <span className="badge badge-info">Miam Club</span>
                </div>
                <div
                  style={{
                    fontSize: '3rem',
                    fontWeight: 700,
                    margin: '0.75rem 0 0.25rem',
                    color: 'var(--mm-brand)',
                    letterSpacing: '-0.03em',
                  }}
                  data-testid="available-points"
                >
                  {balance.availablePoints}
                </div>
                <p style={{ margin: 0, color: 'var(--mm-muted)', fontSize: '0.95rem', fontWeight: 500 }}>
                  points · soit {formatPrice(Math.floor(balance.availablePoints / (balance.rules?.pointsForReward || 15)) * (balance.rules?.rewardDiscountFc || 3000))} de réduction possible
                </p>

                {/* Jauge de progression vers le prochain palier de 15 points */}
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--mm-surface-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', color: 'var(--mm-muted)', marginBottom: '0.35rem' }}>
                    <span>Progression palier</span>
                    <span>{balance.availablePoints % (balance.rules?.pointsForReward || 15)} / {balance.rules?.pointsForReward || 15} pts</span>
                  </div>
                  <div className="stats-track" style={{ height: '8px', background: 'var(--mm-surface-subtle)' }}>
                    <span
                      style={{
                        width: `${Math.min(100, ((balance.availablePoints % (balance.rules?.pointsForReward || 15)) / (balance.rules?.pointsForReward || 15)) * 100)}%`,
                        background: 'var(--mm-brand)',
                      }}
                    />
                  </div>
                  {balance.remainderFc > 0 && (
                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.825rem', color: 'var(--mm-muted)' }}>
                      Dépenses en attente : {formatPrice(balance.remainderFc)} / {formatPrice(balance.rules?.spendPerPointFc || 3000)} pour le prochain point
                    </p>
                  )}
                </div>
              </Card>

              {/* Carte Palier de réduction */}
              <Card>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: 'var(--mm-muted)' }}>
                  Palier de réduction
                </h3>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0.5rem 0 1rem', color: 'var(--mm-text)' }}>
                  {balance.rules?.pointsForReward ?? 15} points = {formatPrice(balance.rules?.rewardDiscountFc ?? 3000)}
                </div>

                <div
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--mm-radius-sm)',
                    background: balance.availablePoints >= (balance.rules?.pointsForReward ?? 15) ? 'var(--mm-ok-bg)' : 'var(--mm-surface-subtle)',
                    border: `1px solid ${balance.availablePoints >= (balance.rules?.pointsForReward ?? 15) ? 'var(--mm-ok-border)' : 'var(--mm-line)'}`,
                  }}
                >
                  {balance.availablePoints >= (balance.rules?.pointsForReward ?? 15) ? (
                    <p style={{ margin: 0, color: 'var(--mm-ok)', fontWeight: 600, fontSize: '0.95rem' }} data-testid="reward-available">
                      Vous avez {balance.availablePoints} points : {Math.floor(balance.availablePoints / (balance.rules?.pointsForReward ?? 15))} réduction(s) disponible(s).
                    </p>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--mm-muted)', fontSize: '0.95rem' }} data-testid="points-missing">
                      Il vous manque {(balance.rules?.pointsForReward ?? 15) - balance.availablePoints} points pour une réduction de {formatPrice(balance.rules?.rewardDiscountFc ?? 3000)}.
                    </p>
                  )}
                </div>

                <div style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--mm-muted)' }}>
                  💡 Les réductions sont applicables directement lors du paiement dans votre panier.
                </div>
              </Card>
            </div>

            {/* Historique des mouvements */}
            <section aria-labelledby="movements-heading">
              <div className="card-head" style={{ marginBottom: '1rem' }}>
                <h3 id="movements-heading" style={{ margin: 0, fontSize: '1.3rem' }}>
                  Historique des mouvements
                </h3>
                <span className="badge badge-neutral">{balance.movements.length} transactions</span>
              </div>

              {balance.movements.length === 0 ? (
                <div className="empty" data-testid="empty-movements">
                  <p style={{ color: 'var(--mm-muted)', margin: 0 }}>
                    Vous n'avez pas encore cumulé de points chez {balance.restaurant.name}.
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
                        <tr style={{ borderBottom: '1.5px solid var(--mm-line)', color: 'var(--mm-muted)', fontSize: '0.875rem' }}>
                          <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Date</th>
                          <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Motif</th>
                          <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'right' }}>Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balance.movements.map((mov) => (
                          <tr key={mov.id} style={{ borderBottom: '1px solid var(--mm-surface-subtle)' }}>
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--mm-muted)', fontSize: '0.9rem' }}>
                              {formatDate(mov.createdAt)}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 500 }}>{mov.reason}</td>
                            <td
                              style={{
                                padding: '0.85rem 1rem',
                                textAlign: 'right',
                                fontWeight: 700,
                                fontSize: '1rem',
                                color: mov.points > 0 ? 'var(--mm-ok)' : 'var(--mm-danger)',
                              }}
                            >
                              {mov.points > 0 ? `+${mov.points}` : mov.points}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </section>
          </>
        ) : null}
      </div>
    </RequireRole>
  );
};

