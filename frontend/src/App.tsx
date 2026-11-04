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
import { AdminSettingsPage } from './views/pages/AdminSettingsPage.tsx';
import { WeeklyStatsPage } from './views/pages/WeeklyStatsPage.tsx';
import { ForgotPasswordPage } from './views/pages/ForgotPasswordPage.tsx';
import { ProfilePage } from './views/pages/ProfilePage.tsx';
import { LegalPage } from './views/pages/LegalPage.tsx';
import { ClaimsPage } from './views/pages/ClaimsPage.tsx';
import { StaffClaimsPage } from './views/pages/StaffClaimsPage.tsx';
import { CommunityPage } from './views/pages/CommunityPage.tsx';

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
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/legal/mentions" element={<LegalPage page="mentions" />} />
                <Route path="/legal/confidentialite" element={<LegalPage page="confidentialite" />} />
                <Route path="/legal/conditions" element={<LegalPage page="conditions" />} />
                <Route
                  path="/profile"
                  element={
                    <RequireRole allowedRoles={['student', 'employee', 'manager', 'admin']}>
                      <ProfilePage />
                    </RequireRole>
                  }
                />
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
                  path="/community"
                  element={
                    <RequireRole allowedRoles={['student']}>
                      <CommunityPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/claims"
                  element={
                    <RequireRole allowedRoles={['student']}>
                      <ClaimsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/staff/claims"
                  element={
                    <RequireRole allowedRoles={['employee', 'manager', 'admin']}>
                      <StaffClaimsPage />
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
                  path="/admin/settings"
                  element={
                    <RequireRole allowedRoles={['admin']}>
                      <AdminSettingsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/staff/weekly"
                  element={
                    <RequireRole allowedRoles={['employee', 'manager', 'admin']}>
                      <WeeklyStatsPage />
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
