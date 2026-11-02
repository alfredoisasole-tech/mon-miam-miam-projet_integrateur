import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider, RestaurantProvider } from './controllers/session.tsx';
import { Layout } from './views/components/Layout.tsx';
import { MenuPage } from './views/pages/MenuPage.tsx';

export function App() {
  return (
    <AuthProvider><RestaurantProvider><BrowserRouter>
      <Routes><Route element={<Layout />}>
        <Route index element={<><h1>Mon Miam Miam</h1><p>Commandez votre repas dans le restaurant de votre choix.</p></>} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="*" element={<><h1>Page indisponible</h1><p>Cette adresse ne correspond pas à une page disponible.</p><Link to="/">Revenir à l’accueil</Link></>} />
      </Route></Routes>
    </BrowserRouter></RestaurantProvider></AuthProvider>
  );
}
