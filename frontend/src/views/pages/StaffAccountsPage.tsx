import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { EMAIL_RE, PHONE_RE, adminApi } from '../../controllers/admin.ts';
import type { StaffAccount } from '../../controllers/admin.ts';
import { useAuth } from '../../controllers/session.tsx';
import { Alert, Badge, Card, Input, Select, Spinner } from '../components/ui.tsx';

const ROLE_LABEL: Record<StaffAccount['role'], string> = { employee: 'Employé', manager: 'Gérant', admin: 'Administrateur' };
const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');

export function StaffAccountsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [accounts, setAccounts] = useState<StaffAccount[] | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'employee' | 'manager'>('employee');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; password: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi.listStaff().then(setAccounts).catch(e => { setAccounts([]); setError(messageOf(e)); });
  }, []);
  useEffect(load, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim().length < 2 || name.trim().length > 80) found.name = 'Le nom fait entre 2 et 80 caractères.';
    if (!EMAIL_RE.test(email.trim())) found.email = 'Adresse e-mail invalide.';
    if (!PHONE_RE.test(phone.trim())) found.phone = 'Format attendu : +243XXXXXXXXX';
    setErrors(found);
    if (Object.keys(found).length) return;
    setError(null);
    try {
      const result = await adminApi.createStaff({ name: name.trim(), email: email.trim(), phone: phone.trim(), role });
      setCreated({ name: result.account.name, password: result.temporaryPassword });
      setName(''); setEmail(''); setPhone(''); setRole('employee');
      load();
    } catch (e) { setError(messageOf(e)); }
  }
  async function deactivate(id: string) {
    setError(null);
    try { await adminApi.deactivateStaff(id); setConfirming(null); load(); }
    catch (e) { setError(messageOf(e)); setConfirming(null); }
  }

  return <section>
    <h1>Comptes du personnel</h1>
    <Alert>{error}</Alert>
    {created && <Alert kind="success">
      Compte créé pour {created.name}. Mot de passe temporaire : <strong>{created.password}</strong>.
      Il ne sera plus affiché : transmettez-le à la personne, qui devra le changer à sa première connexion.
    </Alert>}
    <Card title="Nouveau compte">
      <form onSubmit={submit} noValidate>
        <Input label="Nom" value={name} error={errors.name} onChange={e => setName(e.target.value)} />
        <Input label="E-mail" type="email" value={email} error={errors.email} onChange={e => setEmail(e.target.value)} />
        <Input label="Téléphone" value={phone} error={errors.phone} hint="+243XXXXXXXXX" onChange={e => setPhone(e.target.value)} />
        <Select label="Rôle" value={role} onChange={e => setRole(e.target.value as 'employee' | 'manager')}>
          <option value="employee">Employé</option>
          {isAdmin && <option value="manager">Gérant</option>}
        </Select>
        <button type="submit" className="btn btn-primary">Créer le compte</button>
      </form>
    </Card>
    <h2>Équipe</h2>
    {accounts === null ? <Spinner /> : <ul className="staff-list">
      {accounts.map(account => <li key={account.id} className="card">
        <strong>{account.name}</strong> <Badge kind="neutral">{ROLE_LABEL[account.role]}</Badge>{' '}
        {account.status !== 'active' && <Badge kind="error">Désactivé</Badge>}
        {account.mustChangePassword && <Badge kind="info">Mot de passe à changer</Badge>}
        <div className="muted">{account.email} · {account.phone}</div>
        {isAdmin && account.status === 'active' && account.id !== user?.id && (confirming === account.id
          ? <>
            <button type="button" className="btn btn-danger" onClick={() => void deactivate(account.id)}>Oui, désactiver</button>
            <button type="button" className="btn" onClick={() => setConfirming(null)}>Non</button>
          </>
          : <button type="button" className="btn" onClick={() => setConfirming(account.id)} aria-label={`Désactiver ${account.name}`}>Désactiver</button>)}
      </li>)}
    </ul>}
  </section>;
}
