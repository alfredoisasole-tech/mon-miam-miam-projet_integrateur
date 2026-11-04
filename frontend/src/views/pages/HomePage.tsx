import React, { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRestaurants, type RestaurantItem } from '../../controllers/restaurants.ts';
import { useAuth, useRestaurant } from '../../controllers/session.tsx';
import { Alert, Badge, Card, Spinner } from '../components/ui.tsx';

function useOptionalAuth() {
  try {
    return useAuth();
  } catch {
    return { user: null };
  }
}

export const HomePage: React.FC = () => {
  const { user } = useOptionalAuth();
  const { restaurants, isLoading, error, reload } = useRestaurants({ enabled: !user });
  const { setRestaurant } = useRestaurant();
  const navigate = useNavigate();

  const handleSelectRestaurant = (slug: string) => {
    setRestaurant(slug);
    navigate('/menu');
  };

  return (
    <div className="home-page" data-testid="home-page">
      <header
        className="hero-section"
        style={{
          marginBottom: '2.5rem',
          padding: 'clamp(2rem, 5vw, 3.5rem)',
          background: 'var(--mm-surface)',
          border: '1px solid var(--mm-line)',
          borderRadius: 'var(--mm-radius-lg)',
          boxShadow: 'var(--mm-shadow-sm)',
        }}
      >
        <p className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.75rem' }}>
          Le campus a du goût
        </p>
        <h1 style={{ margin: '0 0 0.5rem', color: 'var(--mm-text)' }}>
          Mon Miam Miam
        </h1>
        <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', fontWeight: 600, color: 'var(--mm-muted)', margin: '0 0 1.25rem' }}>
          Vos repas du campus, commandés en quelques clics
        </h2>
        <p style={{ color: 'var(--mm-muted)', maxWidth: '640px', fontSize: '1.05rem', lineHeight: 1.65, marginBottom: '1.75rem' }}>
          Commandez votre repas dans le restaurant de votre choix. Sur place ou en livraison, cumulez des points de fidélité à chaque commande.
        </p>
        <div>
          <Link
            to="/register"
            className="btn btn-primary"
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              borderRadius: 'var(--mm-radius-sm)',
              boxShadow: 'var(--mm-shadow-sm)',
            }}
          >
            Créer un compte étudiant
          </Link>
        </div>
      </header>

      <section aria-labelledby="restaurants-heading">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 id="restaurants-heading" style={{ margin: 0 }}>
            Nos restaurants
          </h2>
          <span style={{ fontSize: '0.9rem', color: 'var(--mm-muted)' }}>
            Sélectionnez votre table
          </span>
        </div>

        {isLoading && <Spinner label="Chargement des restaurants..." />}

        {error && (
          <Alert kind="error">
            {error}
          </Alert>
        )}

        {!isLoading && !error && restaurants.length === 0 && (
          <div className="empty">
            <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Aucun restaurant disponible pour le moment.</p>
            {user && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => reload()}
                style={{ marginTop: '0.5rem' }}
              >
                Explorer nos restaurants
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && restaurants.length > 0 && (
          <div
            className="restaurants-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {restaurants.map((r: RestaurantItem) => (
              <Card key={r.slug} data-testid={`restaurant-card-${r.slug}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--mm-radius-sm)',
                        background: r.colors?.primary ?? 'var(--mm-color-primary)',
                        color: r.colors?.secondary ?? '#000000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        boxShadow: 'var(--mm-shadow-sm)',
                        flexShrink: 0,
                      }}
                    >
                      {r.name.slice(0, 1).toUpperCase()}
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '-0.01em' }}>{r.name}</h3>
                  </div>
                  <Badge kind={r.isOpenNow ? 'success' : 'neutral'}>
                    {r.isOpenNow ? 'Ouvert' : 'Fermé'}
                  </Badge>
                </div>

                {r.slogan && (
                  <p style={{ color: 'var(--mm-muted)', fontSize: '0.925rem', lineHeight: 1.5, marginBottom: '1.5rem', minHeight: '2.8rem' }}>
                    {r.slogan}
                  </p>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSelectRestaurant(r.slug)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--mm-radius-sm)',
                      backgroundColor: r.colors?.primary ?? 'var(--mm-color-primary, #cfbd97)',
                      color: r.colors?.secondary ?? 'var(--mm-color-secondary, #000000)',
                      fontWeight: 600,
                      boxShadow: 'var(--mm-shadow-sm)',
                    }}
                    data-testid={`select-restaurant-${r.slug}`}
                  >
                    Voir le menu
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export const RestaurantRedirectPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { setRestaurant } = useRestaurant();
  const navigate = useNavigate();

  useEffect(() => {
    if (slug) {
      setRestaurant(slug);
      navigate('/menu', { replace: true });
    }
  }, [slug, setRestaurant, navigate]);

  return <Spinner label="Redirection vers le menu..." />;
};
