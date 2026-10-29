import React from 'react';
// ⚠️ TEMPORAIRE : on utilise le mock en attendant G-7 de Gloirenk17
import { useMenu } from '../../controllers/tempMocks';
import { DishCard } from '../components/DishCard';

export const MenuPage: React.FC = () => {
  const { data: menu, isLoading } = useMenu();

  if (isLoading) return <p>Chargement du menu...</p>;
  if (!menu || menu.length === 0) return <p>Aucun plat disponible pour le moment.</p>;

  return (
    <div className="menu-page">
      <h2>Notre Menu</h2>
      <div className="menu-grid">
        {menu.map((dish) => (
          <DishCard key={dish.id} dish={dish} />
        ))}
      </div>
    </div>
  );
};

