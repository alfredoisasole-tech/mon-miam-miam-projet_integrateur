// ⚠️ FICHIER TEMPORAIRE - À supprimer quand Gloirenk17 aura livré G-3, G-7 et G-8
// Voir PR B-1 pour le contexte

// Mock de G-3 (session)
export function useAuth() {
  // Simule un étudiant connecté pour tester le bouton "Ajouter"
  // Change à null pour tester le mode visiteur
  return {
    user: {
      id: 'temp-user-1',
      name: 'Étudiant Test',
      email: 'test@example.com',
      role: 'student' as const, // change en null pour tester visiteur
    },
    login: () => {},
    logout: () => {},
  };
}

// Mock de G-8 (panier)
export function useCart() {
  return {
    add: (dish: any) => {
      console.log('[MOCK] Ajout au panier :', dish.name);
      alert(`[MOCK] "${dish.name}" ajouté au panier !`);
    },
    remove: () => {},
    clear: () => {},
    items: [],
    count: 0,
  };
}

// Mock de G-7 (menu)
export function useMenu() {
  const fakeMenu = [
    {
      id: '1',
      name: 'Poulet Braisé',
      description: 'Poulet mariné avec alloco',
      priceFc: 4000,
      isAvailable: true,
      category: 'plat',
    },
    {
      id: '2',
      name: 'Poulet Moambe',
      description: 'Poulet à la sauce moambe',
      priceFc: 4500,
      isAvailable: true,
      category: 'plat',
    },
    {
      id: '3',
      name: 'Coca-Cola',
      description: 'Boisson gazeuse 33cl',
      priceFc: 1500,
      isAvailable: true,
      category: 'boisson',
    },
    {
      id: '4',
      name: 'Tiramisu',
      description: 'Dessert du jour',
      priceFc: 2500,
      isAvailable: false, // Épuisé pour tester le badge
      category: 'dessert',
    },
  ];

  return {
    data: fakeMenu,
    isLoading: false,
    error: null,
  };
}