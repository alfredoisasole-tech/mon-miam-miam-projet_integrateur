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
      className="promo-card" 
      data-testid="promo-card"
      role="region" 
      aria-label={`${promotion.type}: ${promotion.title}`}
    >
      {promotion.imageUrl && (
        <img 
          src={promotion.imageUrl} 
          alt="" 
          className="promo-image"
          loading="lazy"
        />
      )}
      <div className="promo-content">
        <div className="promo-header">
          <span className="promo-icon" aria-hidden="true">{getIcon()}</span>
          <h3>{promotion.title}</h3>
        </div>
        <p className="promo-description">{promotion.description}</p>
        <p className="promo-dates" data-testid="promo-end-date">
          Jusqu'au {formatDate(promotion.endDate)}
        </p>
      </div>
    </div>
  );
};