import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider, RestaurantProvider } from './controllers/session.tsx';
import { CartProvider } from './controllers/cart.tsx';
import { Layout } from './views/components/Layout.tsx';
import { RequireRole } from './views/components/RequireRole.tsx';
import { HomePage, RestaurantRedirectPage } from './views/pages/HomePage.tsx';
import { LoginPage } from './views/pages/LoginPage.tsx';
import { MenuPage } from './views/pages/MenuPage.tsx';
import { RegisterPage } from './views/pages/RegisterPage.tsx';
import { CartPage } from './views/pages/CartPage.tsx';
import { MyOrdersPage } from './views/pages/MyOrdersPage.tsx';
import { LoyaltyPage } from './views/pages/LoyaltyPage.tsx';
import { StaffOrdersPage } from './views/pages/StaffOrdersPage.tsx';
import { StatsPage } from './views/pages/StatsPage.tsx';
import { StaffMenuPage } from './views/pages/StaffMenuPage.tsx';
import { AdminMenuPage } from './views/pages/AdminMenuPage.tsx';

export function App() {
  return (
    <AuthProvider>
      <RestaurantProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="/r/:slug" element={<RestaurantRedirectPage />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/cart"
                  element={
                    <RequireRole allowedRoles={['student']}>
                      <CartPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <RequireRole allowedRoles={['student']}>
                      <MyOrdersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/loyalty"
                  element={
                    <RequireRole allowedRoles={['student']}>
                      <LoyaltyPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/staff/orders"
                  element={
                    <RequireRole allowedRoles={['employee', 'manager', 'admin']}>
                      <StaffOrdersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/staff/menu"
                  element={
                    <RequireRole allowedRoles={['employee', 'manager', 'admin']}>
                      <StaffMenuPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin/menu"
                  element={
                    <RequireRole allowedRoles={['admin']}>
                      <AdminMenuPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/staff/overview"
                  element={
                    <RequireRole allowedRoles={['manager', 'admin']}>
                      <StatsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="*"
                  element={
                    <>
                      <h1>Page indisponible</h1>
                      <p>Cette adresse ne correspond pas à une page disponible.</p>
                      <Link to="/">Revenir à l’accueil</Link>
                    </>
                  }
                />
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </RestaurantProvider>
    </AuthProvider>
  );
}
