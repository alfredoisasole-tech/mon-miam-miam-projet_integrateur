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
    <div className="login-page-container">
      <div className="login-card">
        <header className="login-header">
          <h1 className="brand-title">Mon Miam Miam</h1>
          <p className="subtitle">Heureux de vous retrouver à table.</p>
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

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <footer className="login-footer">
          <p>
            Pas encore de compte ? <Link to="/register">Créer un compte</Link>
          </p>
        </footer>
      </div>
    </div>
  );
};