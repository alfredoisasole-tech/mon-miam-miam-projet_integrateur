import React from 'react';
import type { Promotion } from '../../controllers/promotions';

interface PromoCardProps {
  promotion: Promotion;
}

export const PromoCard: React.FC<PromoCardProps> = ({ promotion }) => {
  // Formater la date de fin (JJ/MM/AAAA)
  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Icône selon le type
  const getIcon = () => {
    switch (promotion.type) {
      case 'promotion':
        return '🔥';
      case 'event':
        return '📅'; // ✅ CORRIGÉ : Ajout de l'emoji calendrier
      case 'game':
        return '🎮';
      default:
        return '📢';
    }
  };

  return (
    <div 
      className="promo-card card" 
      data-testid="promo-card"
      role="region" 
      aria-label={`${promotion.type}: ${promotion.title}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 0,
      }}
    >
      {promotion.imageUrl && (
        <img 
          src={promotion.imageUrl} 
          alt="" 
          className="promo-image"
          loading="lazy"
          style={{
            width: '100%',
            height: '160px',
            objectFit: 'cover',
            borderBottom: '1px solid var(--mm-line)',
          }}
        />
      )}
      <div className="promo-content" style={{ padding: '1.25rem' }}>
        <div className="promo-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span className="promo-icon" aria-hidden="true" style={{ fontSize: '1.25rem' }}>{getIcon()}</span>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--mm-text)' }}>{promotion.title}</h3>
        </div>
        <p className="promo-description" style={{ color: 'var(--mm-muted)', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 1rem' }}>
          {promotion.description}
        </p>
        <p className="promo-dates" data-testid="promo-end-date" style={{ margin: 0, fontSize: '0.825rem', color: 'var(--mm-accent)', fontWeight: 600 }}>
          Jusqu'au {formatDate(promotion.endDate)}
        </p>
      </div>
    </div>
  );
};