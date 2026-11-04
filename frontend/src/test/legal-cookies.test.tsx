import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CookieBanner } from '../views/components/CookieBanner.tsx';
import { LegalPage } from '../views/pages/LegalPage.tsx';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('Bannière de cookies', () => {
  it('s’affiche tant que le choix n’est pas fait puis se souvient du refus', async () => {
    const { unmount } = render(<MemoryRouter><CookieBanner /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Cookies' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refuser' }));
    expect(screen.queryByRole('region', { name: 'Cookies' })).toBeNull();
    unmount();
    render(<MemoryRouter><CookieBanner /></MemoryRouter>);
    expect(screen.queryByRole('region', { name: 'Cookies' })).toBeNull();
    expect(localStorage.getItem('mmm_cookies')).toBe('refused');
  });
  it('enregistre l’acceptation et renvoie vers la politique de confidentialité', async () => {
    render(<MemoryRouter><CookieBanner /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /confidentialité/i })).toHaveAttribute('href', '/legal/confidentialite');
    await userEvent.click(screen.getByRole('button', { name: 'Accepter' }));
    expect(localStorage.getItem('mmm_cookies')).toBe('accepted');
  });
});

describe('Pages légales', () => {
  it.each([
    ['mentions', 'Mentions légales'],
    ['confidentialite', 'Politique de confidentialité'],
    ['conditions', 'Conditions générales d’utilisation'],
  ] as const)('affiche la page %s', (page, title) => {
    render(<MemoryRouter><LegalPage page={page} /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });
  it('la confidentialité décrit les droits RGPD de l’utilisateur', () => {
    render(<MemoryRouter><LegalPage page="confidentialite" /></MemoryRouter>);
    expect(screen.getByText(/exporter vos données/i)).toBeInTheDocument();
    expect(screen.getByText(/supprimer votre compte/i)).toBeInTheDocument();
  });
});
