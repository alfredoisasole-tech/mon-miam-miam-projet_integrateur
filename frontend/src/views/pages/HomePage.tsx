import React, { useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
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

/** Page d'arrivée de chaque rôle une fois connecté : le personnel n'a rien à faire sur la page des restaurants. */
export function homeFor(role: string | null | undefined): string {
  if (role === 'platform_admin') return '/plateforme';
  if (role === 'employee' || role === 'manager' || role === 'admin') return '/staff/orders';
  return '/';
}

export const HomePage: React.FC = () => {
  const { user } = useOptionalAuth();
  // Les visiteurs et les étudiants choisissent (ou changent) de restaurant ici.
  const { restaurants, isLoading, error, reload } = useRestaurants({ enabled: !user || user.role === 'student' });
  const { slug, setRestaurant } = useRestaurant();
  const navigate = useNavigate();

  if (user && homeFor(user.role) !== '/') return <Navigate to={homeFor(user.role)} replace />;

  const handleSelectRestaurant = (slug: string) => {
    setRestaurant(slug);
    navigate('/menu');
  };

  return (
    <div className="home-page" data-testid="home-page">
      <header className="hero-section" style={{ marginBottom: '2rem' }}>
        <p style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', fontSize: '0.875rem' }}>
          Le campus a du goût
        </p>
        <h1 style={{ fontSize: '2.25rem', margin: '0.5rem 0 0.5rem' }}>
          Mon Miam Miam
        </h1>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#374151', margin: '0 0 1rem' }}>
          Vos repas du campus, commandés en quelques clics
        </h2>
        <p style={{ color: '#4b5563', maxWidth: '640px', lineHeight: 1.6, marginBottom: '1rem' }}>
          Commandez votre repas dans le restaurant de votre choix. Sur place ou en livraison, cumulez des points de fidélité à chaque commande.
        </p>
        {!user && <div style={{ marginBottom: '1.5rem' }}>
          <Link
            to="/register"
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--mm-color-primary, #cfbd97)',
              color: 'var(--mm-color-secondary, #000000)',
              borderRadius: '0.375rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Créer un compte étudiant
          </Link>
        </div>}
      </header>

      <section aria-labelledby="restaurants-heading">
        <h2 id="restaurants-heading" style={{ fontSize: '1.5rem', marginBottom: '1.25rem' }}>
          Nos restaurants
        </h2>

        {isLoading && <Spinner label="Chargement des restaurants..." />}

        {error && (
          <Alert kind="error">
            {error}
          </Alert>
        )}

        {!isLoading && !error && restaurants.length === 0 && (
          <div>
            <p>Aucun restaurant disponible pour le moment.</p>
            <button
                type="button"
                onClick={() => reload()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--mm-color-primary, #cfbd97)',
                  color: 'var(--mm-color-secondary, #000000)',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                }}
              >
                Réessayer
              </button>
          </div>
        )}

        {!isLoading && !error && restaurants.length > 0 && (
          <div
            className="restaurants-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {restaurants.map((r: RestaurantItem) => (
              <Card key={r.slug} data-testid={`restaurant-card-${r.slug}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{r.name}</h3>
                  <span>
                    {user && slug === r.slug && <Badge kind="info">Votre restaurant</Badge>}{' '}
                    <Badge kind={r.isOpenNow ? 'success' : 'neutral'}>
                      {r.isOpenNow ? 'Ouvert' : 'Fermé'}
                    </Badge>
                  </span>
                </div>

                {r.slogan && (
                  <p style={{ color: '#6b7280', fontSize: '0.925rem', marginBottom: '1rem', minHeight: '2.5rem' }}>
                    {r.slogan}
                  </p>
                )}

                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => handleSelectRestaurant(r.slug)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 1rem',
                      borderRadius: '0.375rem',
                      backgroundColor: r.colors?.primary ?? 'var(--mm-color-primary, #cfbd97)',
                      color: r.colors?.secondary ?? 'var(--mm-color-secondary, #000000)',
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
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
