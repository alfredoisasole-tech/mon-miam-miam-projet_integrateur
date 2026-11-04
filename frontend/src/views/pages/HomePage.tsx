import React, { useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useRestaurants, type RestaurantItem } from '../../controllers/restaurants.ts';
import { useAuth, useRestaurant } from '../../controllers/session.tsx';
import { Alert, Badge, Card, Spinner } from '../components/ui.tsx';
import { RestaurantLogo } from '../components/RestaurantLogo.tsx';
import './home.css';

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
    navigate(`/r/${slug}/menu`);
  };

  return (
    <div className="home-page" data-testid="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-text">
          <p className="eyebrow">La pause qui fait du bien</p>
          <h1 id="home-title">Les saveurs du campus à portée de main.</h1>
          <p className="home-lead">
            Commandez auprès de vos restaurants préférés, retirez sans file d’attente ou faites-vous livrer sur le campus.
            Sur place ou en livraison, cumulez des points de fidélité à chaque commande.
          </p>
          <div className="home-actions">
            <a className="btn btn-primary" href="#restaurants">Découvrir les restaurants →</a>
            {!user && <Link className="btn" to="/register">Créer un compte étudiant</Link>}
          </div>
        </div>
        <div className="home-hero-visual" aria-hidden="true">
          <img src="/mon-miam-miam.svg" alt="" />
          <p>Un compte, plusieurs restaurants.</p>
        </div>
      </section>

      <section id="restaurants" aria-labelledby="restaurants-heading" className="home-section">
        <p className="eyebrow">Les adresses du campus</p>
        <h2 id="restaurants-heading">Nos restaurants</h2>
        <p className="muted home-section-intro">Chaque restaurant prépare ses plats en direct et garde son identité, son menu et son panier.</p>

        {isLoading && <Spinner label="Chargement des restaurants..." />}

        {error && <Alert kind="error">{error}</Alert>}

        {!isLoading && !error && restaurants.length === 0 && (
          <div>
            <p>Aucun restaurant disponible pour le moment.</p>
            <button type="button" className="btn btn-primary" onClick={() => reload()}>Réessayer</button>
          </div>
        )}

        {!isLoading && !error && restaurants.length > 0 && (
          <div className="restaurants-grid">
            {restaurants.map((r: RestaurantItem) => (
              <Card key={r.slug} data-testid={`restaurant-card-${r.slug}`}>
                <RestaurantLogo name={r.name} logoUrl={r.logoUrl} primary={r.colors?.primary} secondary={r.colors?.secondary} />
                <div className="restaurant-card-head">
                  <h3>{r.name}</h3>
                  <span>
                    {user && slug === r.slug && <Badge kind="info">Dernier visité</Badge>}{' '}
                    <Badge kind={r.isOpenNow ? 'success' : 'neutral'}>{r.isOpenNow ? 'Ouvert' : 'Fermé'}</Badge>
                  </span>
                </div>
                {r.slogan && <p className="muted restaurant-card-slogan">{r.slogan}</p>}
                <button type="button" className="btn restaurant-card-action" onClick={() => handleSelectRestaurant(r.slug)} data-testid={`select-restaurant-${r.slug}`}>
                  Voir le menu
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="home-section" aria-labelledby="how-heading">
        <p className="eyebrow home-center">Le service en 3 étapes</p>
        <h2 id="how-heading" className="home-center">Comment ça marche ?</h2>
        <ol className="home-steps">
          <li><span className="home-step-number" aria-hidden="true">1</span><h3>Choisissez vos plats</h3><p>Menus du jour, spécialités locales et boissons fraîches préparés par vos restaurateurs.</p></li>
          <li><span className="home-step-number" aria-hidden="true">2</span><h3>Payez comme vous voulez</h3><p>Par Mobile Money dès la commande, ou en espèces au retrait ou à la livraison.</p></li>
          <li><span className="home-step-number" aria-hidden="true">3</span><h3>Retirez ou faites-vous livrer</h3><p>Présentez votre numéro de commande au comptoir ou recevez votre repas directement sur le campus.</p></li>
        </ol>
      </section>

      <section className="home-loyalty" aria-labelledby="loyalty-heading">
        <p className="eyebrow">Programme de fidélité</p>
        <h2 id="loyalty-heading">Vos pauses ont de la valeur</h2>
        <p>Gagnez des points à chaque repas, dans chaque restaurant, et profitez de réductions sur vos prochaines commandes. Les règles (dépense par point, valeur de la récompense) sont propres à chaque restaurant.</p>
        <p className="home-loyalty-rule">Parrainez vos amis : le code personnel se trouve dans votre compte.</p>
        {!user && <Link className="btn btn-primary" to="/register">Rejoindre le programme</Link>}
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
      navigate(`/r/${slug}/menu`, { replace: true });
    }
  }, [slug, setRestaurant, navigate]);

  return <Spinner label="Redirection vers le menu..." />;
};
