import React, { useState, type FormEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../controllers/session";
import { authApi } from "../../models/api";
import "./LoginPage.css";

export const LoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = (location.state as any)?.from?.pathname || "/";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { token } = await authApi.login({ identifier, password });
      await login(token);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || "Identifiants incorrects");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 180px)', padding: 'clamp(1.5rem, 4vw, 3rem)' }}>
      <div
        style={{
          width: 'min(100%, 960px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'clamp(2rem, 5vw, 4rem)',
          alignItems: 'center',
        }}
      >
        {/* Colonne éditoriale gauche fidèle à la maquette */}
        <div className="login-editorial">
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--mm-muted)',
              textDecoration: 'none',
              marginBottom: '1.75rem',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            ← Retour à l'accueil
          </Link>
          <p className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.5rem' }}>
            Le campus a du goût
          </p>
          <h2 style={{ fontSize: 'clamp(1.85rem, 3.5vw, 2.5rem)', margin: '0 0 1rem', color: 'var(--mm-text)', lineHeight: 1.2 }}>
            Heureux de vous retrouver à table.
          </h2>
          <p style={{ color: 'var(--mm-muted)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            Du premier cours à la dernière pause, retrouvez les saveurs qui vous font du bien.
          </p>
          <div
            style={{
              padding: '1.25rem',
              background: 'var(--mm-surface)',
              borderRadius: 'var(--mm-radius-sm)',
              border: '1px solid var(--mm-line)',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--mm-muted)', lineHeight: 1.5 }}>
              Après connexion, vous rejoignez l'espace de votre rôle. Si vous êtes étudiant, votre panier vous attend là où vous l'avez laissé.
            </p>
          </div>
        </div>

        {/* Formulaire de connexion */}
        <div className="login-card" style={{ width: '100%', margin: 0 }}>
          <header className="login-header">
            <h1 className="brand-title" style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Connexion</h1>
            <p className="subtitle" style={{ fontSize: '0.95rem' }}>Votre prochaine pause commence ici.</p>
          </header>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {error && (
              <div className="error-banner" role="alert" data-testid="login-error">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="identifier">Adresse e-mail ou téléphone</label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="Ex: etudiant@monmiam.test"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading} style={{ marginTop: '0.5rem' }}>
              {isLoading ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <footer className="login-footer">
            <p style={{ margin: 0 }}>
              Pas encore de compte ? <Link to="/register">Créer un compte</Link>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};