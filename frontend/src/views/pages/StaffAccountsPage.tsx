import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { EMAIL_RE, PHONE_RE, adminApi } from '../../controllers/admin.ts';
import type { StaffAccount } from '../../controllers/admin.ts';
import { useAuth } from '../../controllers/session.tsx';
import { Alert, Badge, Card, Input, Select, Spinner } from '../components/ui.tsx';

const ROLE_LABEL: Record<StaffAccount['role'], string> = { employee: 'Employé', manager: 'Gérant', admin: 'Administrateur' };
const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');

/** Formulaire de modification d'un compte : nom, téléphone et rôle (l'e-mail est l'identifiant de connexion). */
function EditAccount({ account, canChangeRole, onSaved, onCancel }: {
  account: StaffAccount; canChangeRole: boolean; onSaved: (message: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone);
  const [role, setRole] = useState<'employee' | 'manager'>(account.role === 'manager' ? 'manager' : 'employee');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  async function save(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim().length < 2 || name.trim().length > 80) found.name = 'Le nom fait entre 2 et 80 caractères.';
    if (!PHONE_RE.test(phone.trim())) found.phone = 'Format attendu : +243XXXXXXXXX';
    setErrors(found);
    if (Object.keys(found).length) return;
    const patch: { name?: string; phone?: string; role?: 'employee' | 'manager' } = {};
    if (name.trim() !== account.name) patch.name = name.trim();
    if (phone.trim() !== account.phone) patch.phone = phone.trim();
    if (canChangeRole && role !== account.role) patch.role = role;
    if (Object.keys(patch).length === 0) { onCancel(); return; }
    setError(null);
    try {
      await adminApi.updateStaff(account.id, patch);
      onSaved(patch.role || patch.phone
        ? `Compte de ${name.trim()} modifié. Cette personne devra se reconnecter.`
        : `Compte de ${name.trim()} modifié.`);
    } catch (e) { setError(messageOf(e)); }
  }
  return <form onSubmit={save} noValidate aria-label={`Modifier ${account.name}`}>
    <Alert>{error}</Alert>
    <Input label="Nom" value={name} error={errors.name} onChange={e => setName(e.target.value)} />
    <Input label="Téléphone" value={phone} error={errors.phone} hint="+243XXXXXXXXX" onChange={e => setPhone(e.target.value)} />
    {canChangeRole && <Select label="Rôle" value={role} onChange={e => setRole(e.target.value as 'employee' | 'manager')}>
      <option value="employee">Employé</option>
      <option value="manager">Gérant</option>
    </Select>}
    <button type="submit" className="btn btn-primary">Enregistrer</button>
    <button type="button" className="btn" onClick={onCancel}>Annuler</button>
  </form>;
}

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
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [reset, setReset] = useState<{ name: string; password: string } | null>(null);
  /** Un gérant réinitialise les employés ; un administrateur, les employés et les gérants. */
  const canReset = (account: StaffAccount) => account.id !== user?.id && account.status === 'active'
    && (isAdmin ? account.role !== 'admin' : user?.role === 'manager' && account.role === 'employee');

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
    setError(null); setSaved(null);
    try { await adminApi.deactivateStaff(id); setConfirming(null); load(); }
    catch (e) { setError(messageOf(e)); setConfirming(null); }
  }
  async function resetPassword(account: StaffAccount) {
    setError(null); setSaved(null); setCreated(null); setReset(null);
    try {
      const result = await adminApi.resetStaffPassword(account.id);
      setReset({ name: account.name, password: result.temporaryPassword });
      setResetting(null);
      load();
    } catch (e) { setError(messageOf(e)); setResetting(null); }
  }
  async function reactivate(account: StaffAccount) {
    setError(null); setSaved(null);
    try { await adminApi.reactivateStaff(account.id); setSaved(`Compte de ${account.name} réactivé.`); load(); }
    catch (e) { setError(messageOf(e)); }
  }

  return <section>
    <h1>Comptes du personnel</h1>
    <Alert>{error}</Alert>
    {saved && <Alert kind="success">{saved}</Alert>}
    {reset && <Alert kind="success">
      Nouveau mot de passe temporaire pour {reset.name} : <strong>{reset.password}</strong>.
      Il ne sera plus affiché : transmettez-le à la personne, qui devra le changer à sa prochaine connexion. Ses anciennes sessions sont fermées.
    </Alert>}
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
        {isAdmin && editing === account.id
          ? <EditAccount account={account} canChangeRole={account.role !== 'admin' && account.id !== user?.id}
            onCancel={() => setEditing(null)} onSaved={message => { setEditing(null); setSaved(message); load(); }} />
          : isAdmin && <button type="button" className="btn" onClick={() => { setSaved(null); setEditing(account.id); }} aria-label={`Modifier ${account.name}`}>Modifier</button>}
        {canReset(account) && (resetting === account.id
          ? <>
            <span>Donner un nouveau mot de passe temporaire à {account.name} ? L’ancien ne fonctionnera plus.</span>
            <button type="button" className="btn btn-danger" onClick={() => void resetPassword(account)}>Oui, générer</button>
            <button type="button" className="btn" onClick={() => setResetting(null)}>Non</button>
          </>
          : <button type="button" className="btn" onClick={() => { setResetting(account.id); setReset(null); }} aria-label={`Nouveau mot de passe pour ${account.name}`}>Mot de passe oublié</button>)}
        {isAdmin && account.status !== 'active' && account.id !== user?.id && (
          <button type="button" className="btn" onClick={() => void reactivate(account)} aria-label={`Réactiver ${account.name}`}>Réactiver</button>)}
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
