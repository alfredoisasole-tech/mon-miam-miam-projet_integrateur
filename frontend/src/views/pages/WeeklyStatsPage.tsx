import { useEffect, useState } from 'react';
import { api } from '../../models/http.ts';
import { formatPrice } from '../../models/format.ts';
import { Alert, Card, Spinner } from '../components/ui.tsx';

interface WeeklyStats {
  totalSalesFc: number;
  ordersCompleted: number;
  days: Array<{ date: string; label: string; salesFc: number; orders: number }>;
}

export function WeeklyStatsPage() {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api.get<WeeklyStats>('/staff/stats/weekly')
      .then(data => { if (active) setStats(data); })
      .catch(() => { if (active) setError('Impossible de charger les ventes de la semaine.'); });
    return () => { active = false; };
  }, []);
  if (error) return <Alert>{error}</Alert>;
  if (!stats) return <Spinner />;
  return <>
    <h1>Ventes de la semaine</h1>
    <Card>
      <p><strong>{formatPrice(stats.totalSalesFc)}</strong> encaissés cette semaine</p>
      <p className="muted">{stats.ordersCompleted} commande{stats.ordersCompleted > 1 ? 's' : ''} terminée{stats.ordersCompleted > 1 ? 's' : ''}</p>
    </Card>
    <table>
      <caption>Ventes par jour</caption>
      <thead><tr><th scope="col">Jour</th><th scope="col">Commandes</th><th scope="col">Ventes</th></tr></thead>
      <tbody>{stats.days.map(day => <tr key={day.date}>
        <th scope="row">{day.label}</th><td>{day.orders}</td><td>{formatPrice(day.salesFc)}</td>
      </tr>)}</tbody>
    </table>
  </>;
}
