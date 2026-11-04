import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PASSWORD_RE, PASSWORD_RULE, accountApi } from '../../controllers/account.ts';
import { Alert, Input } from '../components/ui.tsx';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');

export function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError(null); setBusy(true);
    try { await accountApi.forgotPassword(identifier.trim()); setCodeSent(true); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }
  async function reset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!PASSWORD_RE.test(password)) { setPasswordError(PASSWORD_RULE); return; }
    setPasswordError(undefined); setBusy(true);
    try { await accountApi.resetPassword(identifier.trim(), code.trim(), password); setDone(true); }
    catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }

  if (done) return <section>
    <h1>Mot de passe oublié</h1>
    <Alert kind="success">Votre mot de passe a été changé. Vous pouvez vous connecter.</Alert>
    <Link to="/login" className="btn btn-primary">Se connecter</Link>
  </section>;

  return <section className="auth-page">
    <h1>Mot de passe oublié</h1>
    <Alert>{error}</Alert>
    {!codeSent
      ? <form onSubmit={requestCode} noValidate>
        <Input label="Adresse e-mail ou téléphone" value={identifier} autoComplete="username" onChange={e => setIdentifier(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={busy || !identifier.trim()}>Recevoir un code</button>
      </form>
      : <form onSubmit={reset} noValidate>
        <Alert kind="info">Un code vous a été envoyé si ce compte existe. Il est valable 60 minutes.</Alert>
        <Input label="Code reçu" value={code} autoComplete="one-time-code" onChange={e => setCode(e.target.value)} />
        <Input label="Nouveau mot de passe" type="password" value={password} autoComplete="new-password" error={passwordError} hint={PASSWORD_RULE} onChange={e => setPassword(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={busy || !code.trim()}>Changer le mot de passe</button>
      </form>}
    <p><Link to="/login">Retour à la connexion</Link></p>
  </section>;
}
