import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider, RestaurantProvider } from './controllers/session.tsx';
import { Layout } from './views/components/Layout.tsx';
import { RequireRole } from './views/components/RequireRole.tsx';
import { LoginPage } from './views/pages/LoginPage.tsx';
import { MenuPage } from './views/pages/MenuPage.tsx';
import { RegisterPage } from './views/pages/RegisterPage.tsx';
import { StatsPage } from './views/pages/StatsPage.tsx';
import { StaffMenuPage } from './views/pages/StaffMenuPage.tsx';
import { AdminMenuPage } from './views/pages/AdminMenuPage.tsx';

export function App() {
  return (
    <AuthProvider>
      <RestaurantProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={
                <>
                  <h1>Mon Miam Miam</h1>
                  <p>Commandez votre repas dans le restaurant de votre choix.</p>
                  <Link to="/register">Créer un compte étudiant</Link>
                </>
              } />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/staff/menu" element={
                <RequireRole allowedRoles={['employee', 'manager', 'admin']}>
                  <StaffMenuPage />
                </RequireRole>
              } />
              <Route path="/admin/menu" element={
                <RequireRole allowedRoles={['admin']}>
                  <AdminMenuPage />
                </RequireRole>
              } />
              <Route path="/staff/overview" element={
                <RequireRole allowedRoles={['manager', 'admin']}>
                  <StatsPage />
                </RequireRole>
              } />
              <Route path="*" element={
                <>
                  <h1>Page indisponible</h1>
                  <p>Cette adresse ne correspond pas à une page disponible.</p>
                  <Link to="/">Revenir à l’accueil</Link>
                </>
              } />
            </Route>
          </Routes>
        </BrowserRouter>
      </RestaurantProvider>
    </AuthProvider>
  );
}
