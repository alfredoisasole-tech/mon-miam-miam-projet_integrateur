import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CartProvider } from '../controllers/cart.tsx';
import { AuthProvider, RestaurantProvider, RestaurantScope } from '../controllers/session.tsx';

/** Monte une page dans l'espace d'un restaurant, à son adresse réelle `/r/<restaurant>/<page>`. */
export function AtRestaurant({ slug, page = 'cart', children }: { slug: string; page?: string; children: ReactNode }) {
  return <AuthProvider>
    <RestaurantProvider>
      <CartProvider>
        <MemoryRouter initialEntries={[`/r/${slug}/${page}`]}>
          <Routes>
            <Route path="/r/:slug" element={<RestaurantScope />}>
              <Route path={page} element={children} />
            </Route>
          </Routes>
        </MemoryRouter>
      </CartProvider>
    </RestaurantProvider>
  </AuthProvider>;
}
