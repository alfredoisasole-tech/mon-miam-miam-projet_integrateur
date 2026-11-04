import { useState } from 'react';
import type { FormEvent } from 'react';
import { PASSWORD_RE, PASSWORD_RULE, accountApi } from '../../controllers/account.ts';
import { useAuth } from '../../controllers/session.tsx';
import { Alert, Card, Input } from '../components/ui.tsx';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');
type Feedback = { kind: 'error' | 'success'; text: string } | null;

export function ProfilePage() {
  const { user, login, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [nextError, setNextError] = useState<string>();
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [dataFeedback, setDataFeedback] = useState<Feedback>(null);
  const [confirming, setConfirming] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isStudent = user?.role === 'student';

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!PASSWORD_RE.test(next)) { setNextError(PASSWORD_RULE); return; }
    setNextError(undefined);
    try {
      const { token } = await accountApi.changePassword(current, next);
      await login(token);
      setCurrent(''); setNext('');
      setPasswordFeedback({ kind: 'success', text: 'Votre mot de passe a été changé.' });
    } catch (e) { setPasswordFeedback({ kind: 'error', text: messageOf(e) }); }
  }
  async function exportData() {
    try { await accountApi.exportData(); setDataFeedback({ kind: 'success', text: 'Vos données ont été téléchargées.' }); }
    catch (e) { setDataFeedback({ kind: 'error', text: messageOf(e) }); }
  }
  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setDeleteError(null);
    try { await accountApi.deleteAccount(deletePassword); logout(); }
    catch (e) { setDeleteError(messageOf(e)); }
  }

  return <section className="profile-page">
    <h1>Mon profil</h1>
    <p>{user?.name}</p>

    <Card title="Changer mon mot de passe">
      <Alert kind={passwordFeedback?.kind ?? 'info'}>{passwordFeedback?.text}</Alert>
      <form onSubmit={changePassword} noValidate>
        <Input label="Mot de passe actuel" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
        <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={next} error={nextError} hint={PASSWORD_RULE} onChange={e => setNext(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={!current || !next}>Changer le mot de passe</button>
      </form>
    </Card>

    {isStudent && <Card title="Mes données personnelles">
      <p>Vous pouvez récupérer une copie de vos données ou supprimer votre compte. La suppression est définitive : vos informations personnelles sont effacées et vos points abandonnés.</p>
      <Alert kind={dataFeedback?.kind ?? 'info'}>{dataFeedback?.text}</Alert>
      <button type="button" className="btn" onClick={() => void exportData()}>Télécharger mes données</button>
      {!confirming
        ? <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Supprimer mon compte</button>
        : <form onSubmit={deleteAccount} noValidate>
          <Alert>{deleteError}</Alert>
          <Input label="Mot de passe pour confirmer" type="password" autoComplete="current-password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
          <button type="submit" className="btn btn-danger" disabled={!deletePassword}>Confirmer la suppression</button>
          <button type="button" className="btn" onClick={() => { setConfirming(false); setDeleteError(null); setDeletePassword(''); }}>Annuler</button>
        </form>}
    </Card>}
  </section>;
}
