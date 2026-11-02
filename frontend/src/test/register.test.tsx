import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';


// 1. Le mock DOIT être placé AVANT l'import du composant qui l'utilise
vi.mock('../controllers/session', () => ({
  useAuth: () => ({ login: vi.fn() }),
  useRestaurant: () => ({ slug: 'zeduc-space' }),
}));

// 2. Import du composant
import { RegisterPage } from '../views/pages/RegisterPage';

describe('RegisterPage (G-4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('doit afficher le titre de la page d\'inscription', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    
    // Vérifie que le titre principal est présent
    expect(screen.getByRole('heading', { name: /créez votre compte étudiant/i })).toBeInTheDocument();
  });

  it('doit afficher une erreur si on soumet le formulaire avec le nom vide', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    
    const user = userEvent.setup();
    const submitButton = screen.getByRole('button', { name: /créer mon compte/i });
    
    // On clique sur soumettre sans rien remplir
    await user.click(submitButton);

    // On vérifie que l'erreur du nom apparaît
    expect(await screen.findByText(/le nom est requis/i)).toBeInTheDocument();
  });
});