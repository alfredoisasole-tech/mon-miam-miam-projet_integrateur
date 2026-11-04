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
      {/* Hero Section à deux colonnes fidèle à la maquette */}
      <header
        className="hero-section"
        style={{
          marginBottom: '3rem',
          padding: 'clamp(2rem, 5vw, 3.5rem)',
          background: 'var(--mm-surface)',
          border: '1px solid var(--mm-line)',
          borderRadius: 'var(--mm-radius-lg)',
          boxShadow: 'var(--mm-shadow-sm)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2.5rem',
          alignItems: 'center',
        }}
      >
        <div>
          <p className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.75rem' }}>
            Le campus a du goût
          </p>
          <h1 style={{ margin: '0 0 0.5rem', color: 'var(--mm-text)', fontSize: 'clamp(2rem, 4vw, 2.75rem)' }}>
            Mon Miam Miam
          </h1>
          <h2 style={{ fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)', fontWeight: 600, color: 'var(--mm-muted)', margin: '0 0 1.25rem', lineHeight: 1.4 }}>
            Vos repas du campus, commandés en quelques clics
          </h2>
          <p style={{ color: 'var(--mm-muted)', fontSize: '1rem', lineHeight: 1.65, marginBottom: '2rem' }}>
            Commandez votre repas dans le restaurant de votre choix. Sur place ou en livraison, cumulez des points de fidélité à chaque commande.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a
              href="#restaurants-heading"
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
            >
              Découvrir les restaurants
            </a>
            <Link
              to="/register"
              className="btn btn-outline"
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
            >
              Créer un compte étudiant
            </Link>
          </div>
        </div>

        {/* Carte de mise en avant du plat phare */}
        <div
          style={{
            background: 'var(--mm-surface-subtle)',
            border: '1.5px solid var(--mm-line)',
            borderRadius: 'var(--mm-radius)',
            padding: '2rem',
            position: 'relative',
          }}
        >
          <div className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.5rem' }}>
            À la table du campus
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--mm-text)', marginBottom: '0.5rem' }}>
            Poulet DG & Spécialités
          </div>
          <p style={{ color: 'var(--mm-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            Généreux, coloré, incontournable. Cuisiné chaque jour sur place avec des produits frais du marché.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--mm-line)', paddingTop: '1rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--mm-muted)', fontWeight: 500 }}>
              Menus et promotions consultables sans compte
            </span>
            <span style={{ fontSize: '1.25rem' }}>🍛</span>
          </div>
        </div>
      </header>

      {/* Section Nos restaurants */}
      <section aria-labelledby="restaurants-heading" style={{ marginBottom: '3.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.25rem' }}>Nos adresses</div>
            <h2 id="restaurants-heading" style={{ margin: 0, fontSize: '1.85rem' }}>
              Nos restaurants
            </h2>
          </div>
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.75rem',
            }}
          >
            {restaurants.map((r: RestaurantItem) => (
              <Card key={r.slug} data-testid={`restaurant-card-${r.slug}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: 'var(--mm-radius-sm)',
                        background: r.colors?.primary ?? 'var(--mm-color-primary)',
                        color: r.colors?.secondary ?? '#000000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1.2rem',
                        boxShadow: 'var(--mm-shadow-sm)',
                        flexShrink: 0,
                      }}
                    >
                      {r.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', letterSpacing: '-0.01em' }}>{r.name}</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--mm-muted)' }}>Campus universitaire</span>
                    </div>
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

                <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--mm-surface-subtle)' }}>
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

      {/* Section Comment ça marche (Maquette propre) */}
      <section style={{ marginBottom: '3.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.25rem' }}>Simple & Rapide</div>
          <h2 style={{ fontSize: '1.85rem', margin: 0 }}>Comment ça marche</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--mm-accent)', marginBottom: '0.5rem' }}>01</div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Choisissez votre restaurant</h3>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Explorez les cartes, plats du jour et boissons en accès libre, sans avoir besoin de vous connecter.
            </p>
          </div>

          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--mm-accent)', marginBottom: '0.5rem' }}>02</div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Commandez sur place ou livraison</h3>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Composez votre panier d'un seul restaurant. Choisissez votre heure de retrait ou votre localisation de livraison.
            </p>
          </div>

          <div className="card" style={{ padding: '1.75rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--mm-accent)', marginBottom: '0.5rem' }}>03</div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Suivez et gagnez des points</h3>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Suivez l'avancement en cuisine en temps réel et cumulez 1 point Miam Club par tranche de 3 000 FC dépensés.
            </p>
          </div>
        </div>
      </section>

      {/* Bannière Fidélité Miam Club */}
      <section
        style={{
          background: 'var(--mm-surface-subtle)',
          border: '1.5px solid var(--mm-line)',
          borderRadius: 'var(--mm-radius)',
          padding: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.25rem' }}>Programme Fidélité</div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.35rem' }}>Le Miam Club récompense chaque commande</h3>
          <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>
            <strong>3 000 FC dépensés = 1 point</strong> · <strong>15 points = 3 000 FC de réduction immédiate</strong> sur vos prochains repas.
          </p>
        </div>
        <Link to="/register" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
          Rejoindre le club
        </Link>
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
