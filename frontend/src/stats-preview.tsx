// Données fictives exclusivement dans cet aperçu de développement ; aucun appel API.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { LayoutView } from './views/components/Layout.tsx';
import { Alert, Select } from './views/components/ui.tsx';
import { StatsView } from './views/pages/StatsPage.tsx';
import type { RestaurantStats, StatsPeriod } from './controllers/stats.ts';
import './views/styles.css';
function Preview() {
  const [period, setPeriod] = useState<StatsPeriod>('day');
  const [scenario, setScenario] = useState('normal');
  const multiplier = period === 'day' ? 1 : period === 'week' ? 7 : 24;
  const data: RestaurantStats = { period, salesFc: 120000 * multiplier, averageOrderFc: 4000,
    orders: { total: 35 * multiplier, completed: 30 * multiplier, active: 3 * multiplier, cancelled: 2 * multiplier },
    topItems: [{ name: 'Poulet mayonnaise', quantity: 20 * multiplier }, { name: 'Riz aux haricots', quantity: 16 * multiplier }, { name: 'Fumbwa', quantity: 12 * multiplier }, { name: 'Pondu', quantity: 8 * multiplier }],
  };
  return <MemoryRouter><LayoutView role="manager" onLogout={() => {}}>
    <div className="stack">
      <Alert kind="info">Démonstration E-7 : données fictives. L’API L-11 reste à intégrer.</Alert>
      <Select label="Scénario de démonstration" value={scenario} onChange={event => setScenario(event.target.value)}>
        <option value="normal">Ventes enregistrées</option><option value="empty">Aucune vente</option><option value="loading">Chargement</option><option value="error">Erreur serveur</option><option value="stale">Erreur d’actualisation</option>
      </Select>
      <StatsView period={period} onPeriodChange={setPeriod} onRefresh={() => setScenario('normal')} state={{
        data: scenario === 'loading' || scenario === 'error' ? null : scenario === 'empty' ? { ...data, salesFc: 0, averageOrderFc: 0, orders: { total: 0, completed: 0, active: 0, cancelled: 0 }, topItems: [] } : data,
        error: scenario === 'error' || scenario === 'stale' ? 'Impossible de charger les statistiques. Réessayez.' : null,
        refreshing: scenario === 'loading', updatedAt: scenario === 'loading' || scenario === 'error' ? null : new Date('2026-11-02T10:00:00Z'),
      }} />
    </div>
  </LayoutView></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
