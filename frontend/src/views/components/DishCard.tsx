import React from 'react';
import type { MenuDish } from '../../controllers/useMenu.ts';
import { formatPrice } from '../../models/format';

interface DishCardProps {
  dish: MenuDish;
  isStudent: boolean;
  onAdd: (dish: MenuDish) => void;
}

/**
 * Images de repli par catégorie — URLs publiques des maquettes Stitch (CDN aida-public)
 * Utilisées uniquement quand `dish.imageUrl` est null.
 */
const FALLBACK_BY_CATEGORY: Record<string, string> = {
  plat:    'https://lh3.googleusercontent.com/aida-public/AB6AXuBJ9H7oTB2Rr_DjZEIUJ90YNw8aKRxIJk_WecN62Pn7rXxBU3DAEziXvW0du-YgUCeeCL',
  snack:   'https://lh3.googleusercontent.com/aida-public/AB6AXuCbcxXQUuj1mBRc4IZ56NdmkrAPcbhJyGskbTCOX-TVKixiVdyO2qfyy0jeazpRmt8Jck',
  boisson: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB6z1Dz_feEuEWDUaqhrX852kIBaTBTHfBT4fN0OggYHefADxVc8FsHvJQkLu56a3l9eh',
  dessert: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbcxXQUuj1mBRc4IZ56NdmkrAPcbhJyGskbTCOX-TVKixiVdyO2qfyy0jeazpRmt8Jck',
};

const DEFAULT_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhXXdjY1WR1gfDOgyQ_z0sRMTW-SSyobiWWWkTVHH5-oHAPkUSSSYkDL0MdNaaRCWswK';

/** Déduit la catégorie depuis le nom du plat si absente du modèle. */
function inferCategory(dish: MenuDish): string {
  const name = dish.name.toLowerCase();
  if (/jus|eau|boisson|bissap|lait|café|thé/.test(name)) return 'boisson';
  if (/beignet|dessert|gâteau|yaourt/.test(name)) return 'dessert';
  if (/brochette|alloco|samosa|frite|snack/.test(name)) return 'snack';
  return 'plat';
}

export const DishCard: React.FC<DishCardProps> = ({ dish, isStudent, onAdd }) => {
  const category = inferCategory(dish);
  const imageSrc = dish.imageUrl ?? FALLBACK_BY_CATEGORY[category] ?? DEFAULT_IMAGE;

  return (
    <div
      className={`dish-card ${!dish.isAvailable ? 'is-unavailable' : ''}`}
      data-testid={`dish-${dish.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        opacity: dish.isAvailable ? 1 : 0.7,
      }}
    >
      {/* ── Image 16:10 saignant sur les bords haut/gauche/droite (spec DESIGN.md) ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: '62.5%', /* 16:10 ratio */
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <img
          src={imageSrc}
          alt={dish.name}
          loading="lazy"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.35s ease',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = DEFAULT_IMAGE;
          }}
        />
        {!dish.isAvailable && (
          <div
            style={{
              position: 'absolute',
              top: '0.6rem',
              right: '0.6rem',
            }}
          >
            <span className="badge-epuise" data-testid="epuise-badge">Épuisé</span>
          </div>
        )}
      </div>

      {/* ── Contenu texte ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 'clamp(1rem, 3vw, 1.25rem)',
        }}
      >
        <h3
          style={{
            margin: '0 0 0.35rem',
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'var(--mm-text)',
            lineHeight: 1.3,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {dish.name}
        </h3>

        {dish.description && (
          <p
            style={{
              color: 'var(--mm-muted)',
              fontSize: '0.875rem',
              lineHeight: 1.5,
              margin: '0 0 0.75rem',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {dish.description}
          </p>
        )}

        {/* ── Prix + bouton ajout rapide ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'auto',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--mm-line)',
          }}
        >
          <p className="price" style={{ margin: 0, fontSize: '1rem' }}>
            {formatPrice(dish.priceFc)}
          </p>

          {isStudent && dish.isAvailable && (
            <button
              type="button"
              onClick={() => onAdd(dish)}
              data-testid="add-button"
              aria-label={`Ajouter ${dish.name} au panier`}
              style={{
                width: '44px',
                height: '44px',
                minHeight: '44px',
                padding: 0,
                border: 'none',
                borderRadius: '50%',
                background: 'var(--mm-brand, #cfbd97)',
                color: '#000000',
                fontWeight: 700,
                fontSize: '1.35rem',
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#c3b087'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--mm-brand, #cfbd97)'; }}
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
