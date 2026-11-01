import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, RestaurantProvider } from './controllers/session';
import { RegisterPage } from './views/pages/RegisterPage';

export function App() {
  return (
    // 1. Les providers doivent englober tout le routeur
    <AuthProvider>
      <RestaurantProvider>
        <BrowserRouter>
          <Routes>
            {/* Page d'accueil temporaire */}
            <Route
              path="/"
              element={
                <main style={{ padding: '2rem', textAlign: 'center' }}>
                  <h1>Mon Miam Miam</h1>
                  <p>Commandez votre repas dans le restaurant de votre choix.</p>
                  <a href="/register" style={{ color: '#cfbd97', fontWeight: 'bold' }}>
                    Aller à l'inscription (Test G-4)
                  </a>
                </main>
              }
            />

            {/* G-4 : Page d'inscription */}
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </BrowserRouter>
      </RestaurantProvider>
    </AuthProvider>
  );
}