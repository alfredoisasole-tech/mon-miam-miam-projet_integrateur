import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// 1. MOCK STRICT : Doit être déclaré AVANT tout import du module ciblé
vi.mock('../controllers/session', () => ({
  useAuth: vi.fn(),
}));

// 2. IMPORTATIONS : Après le vi.mock
import { RequireRole } from '../views/components/RequireRole';
import { useAuth } from '../controllers/session';

describe('RequireRole Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche les enfants si le rôle est autorisé', () => {
    // 3. Configuration du mock pour ce test spécifique
    (useAuth as any).mockReturnValue({
      user: { id: '1', name: 'Test', role: 'admin' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<p data-testid="login-page">Page de connexion</p>} />
          <Route path="/" element={<p data-testid="home-page">Accueil</p>} />
          <Route path="/*" element={
            <RequireRole allowedRoles={['admin', 'manager']}>
              <p data-testid="secret-content">Contenu secret admin</p>
            </RequireRole>
          } />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('secret-content')).toBeInTheDocument();
  });

  it('redirige vers la page de connexion si l utilisateur n est pas connecté', () => {
    (useAuth as any).mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<p data-testid="login-page">Page de connexion</p>} />
          <Route path="/" element={<p data-testid="home-page">Accueil</p>} />
          <Route path="/*" element={
            <RequireRole allowedRoles={['admin']}>
              <p data-testid="secret-content">Contenu secret</p>
            </RequireRole>
          } />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId('secret-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('affiche le fallback si le rôle n est pas autorisé', () => {
    (useAuth as any).mockReturnValue({
      user: { id: '2', name: 'Test', role: 'student' },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<p data-testid="login-page">Page de connexion</p>} />
          <Route path="/" element={<p data-testid="home-page">Accueil</p>} />
          <Route path="/*" element={
            <RequireRole allowedRoles={['admin']} fallback={<p data-testid="fallback">Accès non autorisé.</p>}>
              <p data-testid="secret-content">Contenu secret</p>
            </RequireRole>
          } />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('secret-content')).not.toBeInTheDocument();
  });

  it('affiche un message de chargement pendant la vérification de la session', () => {
    (useAuth as any).mockReturnValue({
      user: null,
      loading: true,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<p data-testid="login-page">Page de connexion</p>} />
          <Route path="/" element={<p data-testid="home-page">Accueil</p>} />
          <Route path="/*" element={
            <RequireRole allowedRoles={['admin']}>
              <p data-testid="secret-content">Contenu secret</p>
            </RequireRole>
          } />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
    expect(screen.queryByTestId('secret-content')).not.toBeInTheDocument();
  });
});