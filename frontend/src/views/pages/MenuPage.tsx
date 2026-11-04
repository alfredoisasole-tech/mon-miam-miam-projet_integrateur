import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useInRouterContext } from 'react-router-dom';
import { useAuth, useRestaurant } from '../../controllers/session.tsx';
import { useCart } from '../../controllers/useCart.ts';
import { useMenu, type MenuDish } from '../../controllers/useMenu.ts';
import { formatPrice } from '../../models/format.ts';
import './MenuPage.css';

const AVAILABLE_RESTAURANTS = [
  { slug: 'zeduc-space', name: 'ZeDuc@Space' },
  { slug: 'chez-lea', name: 'Chez Léa' },
];

function SafeLink({ to, children, ...props }: { to: string; children: React.ReactNode; [key: string]: any }) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <Link to={to} {...props}>{children}</Link>;
  }
  return <a href={to} {...props}>{children}</a>;
}

function WithNavigation({ children }: { children: (navigate: (to: string) => void) => React.ReactElement }) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <RouterNavWrapper>{children}</RouterNavWrapper>;
  }
  return children((to: string) => {
    if (typeof window !== 'undefined') window.location.href = to;
  });
}

function RouterNavWrapper({ children }: { children: (navigate: (to: string) => void) => React.ReactElement }) {
  const navigate = useNavigate();
  return children(navigate);
}

const DEFAULT_CATEGORY_TABS = [
  'Tous les plats',
  'Plats principaux',
  'Boissons fraîches',
  'Desserts & Douceurs',
  'Formules Midi',
];

/** Images par défaut de haute qualité selon le nom ou type de plat */
const DISH_FALLBACK_IMAGES: Record<string, string> = {
  poulet: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4TWuk6UBEMPrjtDPFUGiGP4SwCtpshtyD5BnGhL1jJ-E9tOCpvlClBJsyNgznrv_ePRNy0wdn2pZ7lWEExSHAE-MbX4x_zWteC_dxcliWIqwRLX6DHaXQRKd3Ox8h5eqrevFS8MCP9qAAcH-SObR60-Fr10WbVBRokfzlwM3Og2jtA_Qluadpho8p3z3-OHzEkxRaQxIhuJrxaEiq505kh7FvnyTZ_ugJKE6Ge1VLqksu96fjj8nOfQ',
  ndole: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC30SZj6h-COoZZNLggNU5o7ktcmemFECvPcLKSgh0Bl3GLAcupnVUowK2PTEf_4COggLlG1PZmEH3tW4Lg8cx9iSujFRFKy-17lGQz5EWpptvNN18hL7BEuo-X_ab80K2tmyE8fMxEUm-dfJ5Aao9vvrBUV_IpF6WEce_vrRosqr_BcHlxs2MENjP4djIteonfTu3MODFSPIPbjlpDX3x73jApKjZPr7h6kbZ8dcf-UfupfrZF40BB7A',
  brochette: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC4Rnr27o2AZTSlnm-EgHQ8tsbpzWI8lMKETbn_3Ph4dM08bhJTloui6PaRDQmLu6xynVzGybwBVqWu0GqX8cNX_G5ejQk_B5w09GhH6AmrliLewiIoQDlDlq4TBDaiVCxyOqR2T4_VaHEDbZerXYZC7OEGEPrxWByQ80qhfrTKa0xQqv2diXH3PraoSWfDw27yexjLNu7fHCOYLf1FQhbL5pn3FNJ2UiGF3n4PFAE6D7KwuKje2d3OZA',
  bissap: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrx3tusEmuaaGJIZfD7ecEgaQxJULp2czJxBNUdSzMwo7JiFlXCFzpkiUFx3_axZ7usvJfYRHmzZflnLIfpf6dbZQV2zUK_jAC1QL2ngSdgM5vF-4NxoGQF2QEJIZRdOPJG2d695NwGZzpQqggCoBJNs-soafIRVsAIXsCef0JfEWeM3uARQhuV3DETvDLcXPbsCVeIkM83tBW61TFHAafEpkikpGuwVOGWVMKD8tf7hacBKRm1ij8hg',
  poisson: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9lOhLziYBXcb4gUb9ezc1ExA4n3iaj8fDml-sYXhusTx15QjnZZFSpBlk7vPns6kzTmUlZmEW241qdS_3nj8tCVjBkzdexox91rmfRbveC9BC4idjBTGmhVsqyr9PZ2hQD0JR9lP8JfYlf84BmUpPpq7Tbu856qXg2SVP3rjVQHcdpnJLp67py6WSQzWblCSk8K8y7KQzh15Eme0NVh7QkTp1shS_J_cMm3iB33TE1GgYMaaiapVqKA',
  gateau: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIoxH6w8wNOvh4dTJVPTY0yY4QPRnDT9YIv5da6K0lO_4TljL0I-337ntAKT5leNXVtfm1BX2_T2V5x6pL8goW3TNsJJ6giefJaXia_xhROltk0HF36sLrost9_WJUafXbSpg1uU4tWHE9WMbjhD3PD1Vw-nOjpfhl4S3wYCyirRpL9UPffxkP9Op6OiYNGanav5C31hPklvRkCkIWoOtlLNRL8UjAMDm7kosbnfv20nyTOB6DOdEPXA',
};

function getDishImage(name: string, imageUrl?: string | null): string {
  if (imageUrl) return imageUrl;
  const lower = name.toLowerCase();
  if (lower.includes('poulet')) return DISH_FALLBACK_IMAGES.poulet;
  if (lower.includes('ndole') || lower.includes('ndolé')) return DISH_FALLBACK_IMAGES.ndole;
  if (lower.includes('brochette') || lower.includes('boeuf') || lower.includes('bœuf')) return DISH_FALLBACK_IMAGES.brochette;
  if (lower.includes('bissap') || lower.includes('jus') || lower.includes('eau')) return DISH_FALLBACK_IMAGES.bissap;
  if (lower.includes('poisson') || lower.includes('tilapia')) return DISH_FALLBACK_IMAGES.poisson;
  if (lower.includes('gateau') || lower.includes('gâteau') || lower.includes('beignet') || lower.includes('banane')) return DISH_FALLBACK_IMAGES.gateau;
  return DISH_FALLBACK_IMAGES.poulet;
}

function getDishBadge(dish: MenuDish): { label: string; kind: 'coup-coeur' | 'disponible' | 'frais' | 'dessert' | 'epuise' } {
  if (!dish.isAvailable) return { label: 'Indisponible aujourd’hui', kind: 'epuise' };
  const lower = dish.name.toLowerCase();
  if (lower.includes('poulet') || lower.includes('signature')) return { label: 'Coup de Cœur', kind: 'coup-coeur' };
  if (lower.includes('ndole') || lower.includes('ndolé')) return { label: 'Disponible', kind: 'disponible' };
  if (lower.includes('bissap') || lower.includes('jus')) return { label: 'Frais', kind: 'frais' };
  if (lower.includes('gateau') || lower.includes('gâteau') || lower.includes('beignet')) return { label: 'Dessert du Jour', kind: 'dessert' };
  if (dish.isDaily) return { label: 'Plat du jour', kind: 'coup-coeur' };
  return { label: 'Disponible', kind: 'disponible' };
}

export const MenuPage: React.FC = () => {
  return (
    <WithNavigation>
      {(navigate) => <MenuPageContent navigate={navigate} />}
    </WithNavigation>
  );
};

const MenuPageContent: React.FC<{ navigate: (to: string) => void }> = ({ navigate }) => {
  const { slug, setRestaurant } = useRestaurant();
  const { user } = useAuth();
  const { data: menu, isLoading, error } = useMenu(slug);
  const cartManager = useCart();
  const cartLines = cartManager.cart?.lines ?? [];
  const cartTotal = cartManager.totalFc ?? 0;
  const cartCount = cartManager.count ?? 0;

  // Filtres interactifs
  const [activeCategory, setActiveCategory] = useState<string>('Tous les plats');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyAvailable, setOnlyAvailable] = useState<boolean>(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState<boolean>(false);

  // Tous les plats combinés
  const allDishes = useMemo(() => {
    if (!menu) return [];
    const map = new Map<string, MenuDish & { categoryName?: string }>();
    
    // Plats du jour
    for (const d of menu.dailyItems) {
      map.set(d.id, { ...d, categoryName: 'Formules Midi' });
    }
    // Catégories
    for (const cat of menu.categories) {
      for (const d of cat.items) {
        if (!map.has(d.id)) {
          map.set(d.id, { ...d, categoryName: cat.name });
        }
      }
    }
    return Array.from(map.values());
  }, [menu]);

  // Filtrage réactif
  const filteredDishes = useMemo(() => {
    return allDishes.filter((dish) => {
      // Filtre disponibilité
      if (onlyAvailable && !dish.isAvailable) return false;

      // Filtre recherche textuelle
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = dish.name.toLowerCase().includes(query);
        const matchesDesc = (dish.description ?? '').toLowerCase().includes(query);
        if (!matchesName && !matchesDesc) return false;
      }

      // Filtre catégorie
      if (activeCategory === 'Tous les plats') return true;
      if (activeCategory === 'Plats principaux') {
        const cat = (dish.categoryName ?? '').toLowerCase();
        return cat.includes('plat') || cat.includes('chaud') || (!cat.includes('boisson') && !cat.includes('dessert') && !cat.includes('snack'));
      }
      if (activeCategory === 'Boissons fraîches') {
        const cat = (dish.categoryName ?? '').toLowerCase();
        return cat.includes('boisson') || dish.name.toLowerCase().includes('bissap') || dish.name.toLowerCase().includes('jus') || dish.name.toLowerCase().includes('eau');
      }
      if (activeCategory === 'Desserts & Douceurs') {
        const cat = (dish.categoryName ?? '').toLowerCase();
        return cat.includes('dessert') || dish.name.toLowerCase().includes('gâteau') || dish.name.toLowerCase().includes('beignet');
      }
      if (activeCategory === 'Formules Midi') {
        return dish.isDaily || (dish.categoryName ?? '').toLowerCase().includes('midi');
      }

      return dish.categoryName === activeCategory;
    });
  }, [allDishes, activeCategory, searchQuery, onlyAvailable]);

  // Actions du panier
  const handleAddDish = (dish: MenuDish) => {
    cartManager.addProduct({
      id: dish.id,
      restaurantSlug: menu?.restaurant ?? slug ?? 'zeduc-space',
      name: dish.name,
      unitPriceFc: dish.priceFc,
    });
  };

  const handleSwitchRestaurant = (newSlug: string) => {
    if (cartLines.length > 0) {
      cartManager.clearCart();
    }
    setRestaurant(newSlug);
    setIsSwitchModalOpen(false);
  };

  // Gestion des états globaux (Requis par les tests de non-régression)
  if (!slug) return <p className="empty">Choisissez un restaurant pour afficher son menu.</p>;
  if (isLoading) return <p className="muted">Chargement du menu...</p>;
  if (error) return <p className="alert alert-error" role="alert">{error}</p>;
  if (!menu || allDishes.length === 0) {
    return <p className="empty">Aucun plat disponible pour le moment.</p>;
  }

  const restaurantName = slug === 'zeduc-space'
    ? 'ZeDuc@Space - Bistro Universitaire & Grande Table'
    : (AVAILABLE_RESTAURANTS.find((r) => r.slug === slug)?.name ?? (slug.charAt(0).toUpperCase() + slug.slice(1)));

  // Autre restaurant vers lequel changer
  const alternateRestaurant = AVAILABLE_RESTAURANTS.find((r) => r.slug !== slug) ?? {
    slug: slug === 'zeduc-space' ? 'chez-lea' : 'zeduc-space',
    name: slug === 'zeduc-space' ? 'Chez Léa' : 'ZeDuc@Space',
  };

  const earnedPoints = Math.max(1, Math.floor(cartTotal / 3000));

  return (
    <div className="zeduc-layout" data-testid="zeduc-menu-layout">
      {/* ── 1. BREADCRUMB STRIP ── */}
      <nav className="zeduc-breadcrumb" aria-label="Fil d'Ariane">
        <SafeLink to="/">
          <span aria-hidden="true">🍽️</span> Restaurants
        </SafeLink>
        <span className="zeduc-breadcrumb-sep">›</span>
        <span className="zeduc-breadcrumb-current">{slug === 'zeduc-space' ? 'ZeDuc@Space' : restaurantName}</span>
      </nav>

      {/* ── 2. RESTAURANT HEADER SECTION ── */}
      <section className="zeduc-header-card" aria-label="Informations du restaurant">
        <div className="zeduc-header-top">
          <div>
            <div className="zeduc-title-group">
              <h1 className="zeduc-restaurant-title">{restaurantName}</h1>
              <span className="zeduc-status-badge">
                <span className="zeduc-pulse-dot" aria-hidden="true"></span>
                Ouvert aujourd'hui jusqu'à 21h30
              </span>
            </div>

            <div className="zeduc-meta-list">
              <span className="zeduc-meta-item">
                <span aria-hidden="true">📍</span> Campus Nord, Bâtiment C (près de la Bibliothèque)
              </span>
              <span className="zeduc-meta-item">
                <span aria-hidden="true">🕒</span> Horaires : Lun - Sam de 08h00 à 21h30
              </span>
              <span className="zeduc-meta-item">
                <span aria-hidden="true">🥡</span> Mode de retrait : Sur place ou Livraison campus
              </span>
            </div>
          </div>

          <button
            type="button"
            className="zeduc-btn-switch"
            onClick={() => setIsSwitchModalOpen(true)}
            aria-haspopup="dialog"
          >
            <span aria-hidden="true">⇄</span> Changer de restaurant
          </button>
        </div>

        {/* Bannière Promotionnelle ZeDuc@Space */}
        <div className="zeduc-promo-banner" role="complementary">
          <div className="zeduc-promo-info">
            <div className="zeduc-promo-icon-box" aria-hidden="true">🏷️</div>
            <div>
              <span className="zeduc-promo-title">Soirée Grillades &amp; Bissap Frais</span>
              <p className="zeduc-promo-text">1 boisson offerte pour 2 menus achetés du 24 au 26 Octobre.</p>
            </div>
          </div>
          <span className="zeduc-promo-tag">Offre automatique au panier</span>
        </div>
      </section>

      {/* ── 3. CONTENT LAYOUT : CATALOGUE (68%) + PANIER PERSISTANT (32%) ── */}
      <div className="zeduc-split-layout">
        {/* COLONNE GAUCHE : CATALOGUE DES PLATS */}
        <section className="zeduc-catalog-col" aria-label="Catalogue des plats">
          {/* Barre de filtres et recherche */}
          <div className="zeduc-filter-card">
            {/* Onglets de catégories */}
            <div className="zeduc-tabs-bar" role="tablist" aria-label="Catégories de plats">
              {DEFAULT_CATEGORY_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === tab}
                  className={`zeduc-tab-btn ${activeCategory === tab ? 'active' : ''}`}
                  onClick={() => setActiveCategory(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Champ de recherche & Switch disponibilité */}
            <div className="zeduc-filter-controls">
              <div className="zeduc-search-box">
                <span className="zeduc-search-icon" aria-hidden="true">🔍</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un plat (ex: Poulet DG, Ndolé, Bissap)..."
                  className="zeduc-search-input"
                  aria-label="Rechercher un plat"
                />
              </div>

              <label className="zeduc-switch-label">
                <span>Afficher seulement les plats disponibles</span>
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                  className="sr-only zeduc-switch-input"
                />
                <div className="zeduc-toggle-track" aria-hidden="true">
                  <div className="zeduc-toggle-thumb"></div>
                </div>
              </label>
            </div>
          </div>

          {/* Grille des plats en 2 colonnes */}
          {filteredDishes.length === 0 ? (
            <div className="empty">
              <p style={{ margin: 0 }}>Aucun plat ne correspond à vos critères de recherche.</p>
            </div>
          ) : (
            <div className="zeduc-meals-grid">
              {filteredDishes.map((dish) => {
                const badge = getDishBadge(dish);
                const imgSrc = getDishImage(dish.name, dish.imageUrl);

                return (
                  <article
                    key={dish.id}
                    className={`zeduc-meal-card ${!dish.isAvailable ? 'is-unavailable' : ''}`}
                    data-testid={`dish-${dish.id}`}
                  >
                    <div>
                      {/* Image avec zoom subtil au survol et badge en coin */}
                      <div className="zeduc-meal-img-wrap">
                        <img
                          src={imgSrc}
                          alt={dish.name}
                          loading="lazy"
                          className={`zeduc-meal-img ${!dish.isAvailable ? 'is-grayscale' : ''}`}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = DISH_FALLBACK_IMAGES.poulet;
                          }}
                        />

                        {dish.isAvailable ? (
                          <span className={`zeduc-badge-corner zeduc-badge-${badge.kind}`}>
                            {badge.label}
                          </span>
                        ) : (
                          <div className="zeduc-badge-epuise-overlay">
                            <span className="zeduc-badge-epuise-pill" data-testid="epuise-badge">
                              Indisponible aujourd'hui
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Corps texte */}
                      <div className="zeduc-meal-body">
                        <h3 className="zeduc-meal-title">{dish.name}</h3>
                        {dish.description && (
                          <p className="zeduc-meal-desc">{dish.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Prix et bouton d'action */}
                    <div className="zeduc-meal-footer">
                      <span className="zeduc-meal-price">{formatPrice(dish.priceFc)}</span>
                      {dish.isAvailable ? (
                        <button
                          type="button"
                          onClick={() => handleAddDish(dish)}
                          data-testid="add-button"
                          className="zeduc-btn-add"
                          aria-label={`Ajouter ${dish.name} au panier`}
                        >
                          <span aria-hidden="true">+</span> Ajouter
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="zeduc-btn-disabled"
                          aria-label={`${dish.name} est épuisé`}
                        >
                          <span aria-hidden="true">🚫</span> Épuisé
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* COLONNE DROITE : PANIER PERSISTANT STICKY (32%) */}
        <aside className="zeduc-sidebar-col" aria-label="Votre commande en cours">
          <div className="zeduc-cart-card">
            {/* Entête du panier */}
            <div className="zeduc-cart-header">
              <div className="zeduc-cart-title-wrap">
                <span className="zeduc-cart-icon" aria-hidden="true">🛍️</span>
                <h2 className="zeduc-cart-title">Mon Panier</h2>
              </div>
              <span className="zeduc-cart-count-badge">
                {cartCount} {cartCount > 1 ? 'articles' : 'article'}
              </span>
            </div>

            {/* Rappel du restaurant sélectionné */}
            <div className="zeduc-cart-anchor">
              <span>Restaurant sélectionné :</span>
              <span className="zeduc-cart-anchor-name">
                {slug === 'zeduc-space' ? 'ZeDuc@Space (Campus Nord)' : restaurantName}
              </span>
            </div>

            {/* Liste des articles du panier */}
            {cartLines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#7d766b' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.925rem' }}>Votre panier est vide.</p>
                <small style={{ color: '#a8a296' }}>Sélectionnez un plat pour composer votre menu.</small>
              </div>
            ) : (
              <div className="zeduc-cart-items-list" role="list">
                {cartLines.map((item) => {
                  const itemThumb = getDishImage(item.name);
                  return (
                    <div key={item.id} className="zeduc-cart-item-row" role="listitem">
                      <img
                        src={itemThumb}
                        alt=""
                        className="zeduc-cart-item-thumb"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DISH_FALLBACK_IMAGES.poulet;
                        }}
                      />
                      <div className="zeduc-cart-item-content">
                        <div className="zeduc-cart-item-top">
                          <h4 className="zeduc-cart-item-name">{item.name}</h4>
                          <button
                            type="button"
                            onClick={() => cartManager.removeProduct(item.id)}
                            className="zeduc-btn-remove"
                            title="Retirer cet article"
                            aria-label={`Retirer ${item.name} du panier`}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="zeduc-cart-item-unit">
                          {formatPrice(item.unitPriceFc)} / unité
                        </div>
                        <div className="zeduc-cart-item-bottom">
                          {/* Sélecteur de quantité tactile */}
                          <div className="zeduc-qty-selector">
                            <button
                              type="button"
                              className="zeduc-qty-btn"
                              onClick={() => {
                                if (item.quantity <= 1) {
                                  cartManager.removeProduct(item.id);
                                } else {
                                  cartManager.updateProductQuantity(item.id, item.quantity - 1);
                                }
                              }}
                              aria-label={`Diminuer la quantité de ${item.name}`}
                            >
                              -
                            </button>
                            <span className="zeduc-qty-num">{item.quantity}</span>
                            <button
                              type="button"
                              className="zeduc-qty-btn"
                              onClick={() => cartManager.updateProductQuantity(item.id, item.quantity + 1)}
                              aria-label={`Augmenter la quantité de ${item.name}`}
                            >
                              +
                            </button>
                          </div>
                          <span className="zeduc-cart-item-line-total">
                            {formatPrice(item.unitPriceFc * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Encart incitatif Miam Club */}
            <div className="zeduc-loyalty-box">
              <span className="zeduc-loyalty-icon" aria-hidden="true">⭐</span>
              <div>
                <strong>Programme Miam Club :</strong>
                <p style={{ margin: 0, color: '#5f5a4e' }}>
                  Vous cumulerez <strong style={{ color: '#6b5d3d' }}>+{earnedPoints} point(s) fidélité</strong> avec cette commande (dès 3 000 FC).
                </p>
              </div>
            </div>

            {/* Détail du calcul des prix */}
            <div className="zeduc-pricing-breakdown">
              <div className="zeduc-pricing-row">
                <span>Sous-total</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              <div className="zeduc-pricing-row">
                <span>Frais de service campus</span>
                <span style={{ color: '#0a6c44', fontWeight: 600 }}>0 FC (Inclus)</span>
              </div>
              <div className="zeduc-pricing-row total-row">
                <span>Total à régler</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
            </div>

            {/* Bouton d'action principal : Commander */}
            <button
              type="button"
              className="zeduc-btn-order"
              disabled={cartLines.length === 0}
              onClick={() => navigate('/cart')}
            >
              <span>Commander ({formatPrice(cartTotal)})</span>
              <span aria-hidden="true">→</span>
            </button>

            {/* Note d'aide visiteur / connexion */}
            <div className="zeduc-visitor-note">
              <span aria-hidden="true" style={{ color: '#6b5d3d' }}>ℹ️</span>
              <span>
                {user
                  ? `Connecté en tant que ${user.name}. Vous pouvez finaliser votre commande en un clic.`
                  : 'Vous êtes en mode visiteur. Vous pourrez vous connecter ou créer un compte en un clic pour confirmer votre commande.'}
              </span>
            </div>
          </div>

          {/* Carte Protection de commande */}
          <div className="zeduc-protection-card">
            <div className="zeduc-protection-title">
              <span aria-hidden="true" style={{ color: '#b7791f' }}>🛡️</span>
              Protection de votre commande
            </div>
            <p className="zeduc-protection-text">
              Votre panier est synchronisé uniquement avec {restaurantName}. Si vous parcourez un autre établissement, un avertissement vous permettra de valider avant toute modification.
            </p>
          </div>
        </aside>
      </div>

      {/* ── 4. MODALE DE CHANGEMENT DE RESTAURANT (Heuristique 5) ── */}
      {isSwitchModalOpen && (
        <div
          className="zeduc-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-modal-title"
        >
          <div className="zeduc-modal-box">
            <div className="zeduc-modal-header">
              <div className="zeduc-modal-icon-badge" aria-hidden="true">⚠️</div>
              <h3 id="switch-modal-title" className="zeduc-modal-title">
                Avertissement changement de restaurant
              </h3>
            </div>

            <p className="zeduc-modal-desc">
              Si vous changez de restaurant vers <strong>{alternateRestaurant.name}</strong>, les{' '}
              <strong>{cartCount} articles</strong> de votre commande actuelle seront retirés de votre panier.
            </p>

            <div className="zeduc-modal-actions">
              <button
                type="button"
                className="zeduc-btn-stay"
                onClick={() => setIsSwitchModalOpen(false)}
              >
                Rester ici
              </button>
              <button
                type="button"
                className="zeduc-btn-confirm-switch"
                onClick={() => handleSwitchRestaurant(alternateRestaurant.slug)}
              >
                Changer et vider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alertes d'erreur panier si présentes */}
      {cartManager.error && <p className="alert alert-error" role="alert">{cartManager.error}</p>}
    </div>
  );
};
