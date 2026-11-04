import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { communityApi } from '../controllers/community.ts';
import type { Referral } from '../controllers/community.ts';
import { CommunityPage } from '../views/pages/CommunityPage.tsx';
import { HigherLowerGame } from '../views/components/games/HigherLowerGame.tsx';
import { QuizGame, QUESTIONS } from '../views/components/games/QuizGame.tsx';
import { MemoryGame } from '../views/components/games/MemoryGame.tsx';
import * as session from '../controllers/session.tsx';

vi.mock('../controllers/community.ts', () => ({ communityApi: { referral: vi.fn(), topClients: vi.fn() } }));
vi.mock('../controllers/session.tsx', () => ({ useRestaurant: vi.fn() }));
const api = vi.mocked(communityApi);

const referral: Referral = {
  code: 'A1B2C3D4E5F6', restaurant: { slug: 'zeduc-space', name: 'ZeDuc@Space' },
  referees: [
    { name: 'Alice M.', status: 'pending', rewardPoints: null, rewardedAt: null, rewardRestaurant: null, joinedAt: '2026-11-01T09:00:00.000Z' },
    { name: 'Bob I.', status: 'rewarded', rewardPoints: 2, rewardedAt: '2026-11-04T10:00:00.000Z', rewardRestaurant: { slug: 'zeduc-space', name: 'ZeDuc@Space' }, joinedAt: '2026-11-02T09:00:00.000Z' },
  ],
  totals: { referees: 2, rewarded: 1, pointsEarned: 2 },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(session.useRestaurant).mockReturnValue({ slug: 'zeduc-space', setRestaurant: vi.fn(), clearRestaurant: vi.fn() });
  api.referral.mockResolvedValue(referral);
  api.topClients.mockResolvedValue({ period: 'month', from: '', restaurant: referral.restaurant, items: [
    { rank: 1, name: 'Bob I.', orders: 5, spentFc: 20000, isMe: false },
    { rank: 2, name: 'Moi M.', orders: 3, spentFc: 9000, isMe: true },
  ] });
});
afterEach(cleanup);

describe('Communauté', () => {
  it('affiche le code de parrainage et le suivi des filleuls', async () => {
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);
    expect(await screen.findByText('A1B2C3D4E5F6')).toBeInTheDocument();
    expect(screen.getByText('Alice M.')).toBeInTheDocument();
    expect(screen.getByText(/en attente/i)).toBeInTheDocument();
    expect(screen.getByText(/2 points · ZeDuc/)).toBeInTheDocument();
  });
  it('copie le code', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('button', { name: 'Copier le code' }));
    expect(writeText).toHaveBeenCalledWith('A1B2C3D4E5F6');
  });
  it('affiche le top 10 du mois puis change de période', async () => {
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);
    await userEvent.click(await screen.findByRole('tab', { name: 'Top 10' }));
    expect(await screen.findByText('Bob I.')).toBeInTheDocument();
    expect(api.topClients).toHaveBeenCalledWith('zeduc-space', 'month');
    expect(screen.getByRole('row', { name: /Moi M\./ })).toHaveTextContent('vous');
    await userEvent.click(screen.getByRole('button', { name: 'Semaine' }));
    await waitFor(() => expect(api.topClients).toHaveBeenCalledWith('zeduc-space', 'week'));
  });
  it('signale une erreur de chargement', async () => {
    api.referral.mockRejectedValue(new Error('hors ligne'));
    render(<MemoryRouter><CommunityPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent(/impossible/i);
  });
});

describe('Mini-jeux', () => {
  it('Plus ou moins : indique plus, moins puis gagné', async () => {
    render(<HigherLowerGame random={() => 0.49} />); // secret = 50
    const input = screen.getByLabelText('Votre nombre');
    await userEvent.type(input, '20');
    await userEvent.click(screen.getByRole('button', { name: 'Proposer' }));
    expect(screen.getByRole('status')).toHaveTextContent(/plus/i);
    await userEvent.clear(input);
    await userEvent.type(input, '80');
    await userEvent.click(screen.getByRole('button', { name: 'Proposer' }));
    expect(screen.getByRole('status')).toHaveTextContent(/moins/i);
    await userEvent.clear(input);
    await userEvent.type(input, '50');
    await userEvent.click(screen.getByRole('button', { name: 'Proposer' }));
    expect(screen.getByRole('status')).toHaveTextContent(/gagné/i);
    expect(screen.getByRole('status')).toHaveTextContent('3');
  });
  it('Plus ou moins : refuse un nombre hors limites', async () => {
    render(<HigherLowerGame random={() => 0.5} />);
    await userEvent.type(screen.getByLabelText('Votre nombre'), '500');
    await userEvent.click(screen.getByRole('button', { name: 'Proposer' }));
    expect(screen.getByRole('status')).toHaveTextContent(/entre 1 et 100/);
  });
  it('Quiz : compte les bonnes réponses et propose de rejouer', async () => {
    render(<QuizGame />);
    for (const question of QUESTIONS) {
      await userEvent.click(screen.getByRole('button', { name: question.options[question.answer] }));
      await userEvent.click(screen.getByRole('button', { name: /Question suivante|Voir le score/ }));
    }
    expect(screen.getByRole('status')).toHaveTextContent(`${QUESTIONS.length} / ${QUESTIONS.length}`);
    await userEvent.click(screen.getByRole('button', { name: 'Rejouer' }));
    expect(screen.getByText(QUESTIONS[0].question)).toBeInTheDocument();
  });
  it('Quiz : une mauvaise réponse est signalée', async () => {
    render(<QuizGame />);
    const wrong = QUESTIONS[0].options.findIndex((_, i) => i !== QUESTIONS[0].answer);
    await userEvent.click(screen.getByRole('button', { name: QUESTIONS[0].options[wrong] }));
    expect(screen.getByRole('status')).toHaveTextContent(/pas tout à fait/i);
  });
  it('Mémoire : deux cartes identiques restent visibles, la partie se termine', async () => {
    render(<MemoryGame random={() => 0.999} />);
    const cards = screen.getAllByRole('button', { name: /Carte \d+/ });
    expect(cards).toHaveLength(12);
    // Sans mélange (random ≈ 1), les paires sont côte à côte : 1-2, 3-4, …
    for (let i = 0; i < 12; i += 2) {
      await userEvent.click(cards[i]);
      await userEvent.click(cards[i + 1]);
    }
    expect(screen.getByRole('status')).toHaveTextContent(/bravo/i);
    expect(screen.getByRole('status')).toHaveTextContent('6 coups');
  });
  it('Mémoire : deux cartes différentes se retournent', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<MemoryGame random={() => 0.999} />);
    const cards = screen.getAllByRole('button', { name: /Carte \d+/ });
    await userEvent.click(cards[0]);
    await userEvent.click(cards[2]);
    expect(cards[0]).toHaveAttribute('aria-pressed', 'true');
    await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
    expect(cards[0]).toHaveAttribute('aria-pressed', 'false');
    vi.useRealTimers();
  });
});
