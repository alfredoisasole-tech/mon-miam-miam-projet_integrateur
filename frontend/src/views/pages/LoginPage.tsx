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
              marginBottom: '1.25rem',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            ← Retour à l'accueil
          </Link>

          {/* Pill Restauration Universitaire d'Excellence */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              background: '#f4ede0',
              border: '1px solid #e4dcc8',
              color: '#6b5d3d',
              fontSize: '0.8rem',
              fontWeight: 700,
              marginBottom: '1rem',
            }}
          >
            <span aria-hidden="true">🍴</span> Restauration Universitaire d'Excellence
          </div>

          <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.35rem)', margin: '0 0 1rem', color: 'var(--mm-text)', lineHeight: 1.25, fontWeight: 800 }}>
            Retrouvez les saveurs de votre campus.
          </h2>

          <p style={{ color: 'var(--mm-muted)', fontSize: '0.975rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            Connectez-vous pour suivre votre commande en direct auprès de ZeDuc@Space &amp; Chez Léa, et cumulez vos points Miam Club à chaque repas.
          </p>

          {/* Carte Visuelle Chef Cuisto / Plat Signature */}
          <div
            className="login-dish-card"
            style={{
              background: '#ffffff',
              border: '1px solid #e5e2db',
              borderRadius: '16px',
              padding: '0.85rem',
              boxShadow: '0 8px 24px rgba(95, 90, 78, 0.07)',
            }}
          >
            {/* Image avec Overlay */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '210px',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#1a1a1a',
              }}
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB4TWuk6UBEMPrjtDPFUGiGP4SwCtpshtyD5BnGhL1jJ-E9tOCpvlClBJsyNgznrv_ePRNy0wdn2pZ7lWEExSHAE-MbX4x_zWteC_dxcliWIqwRLX6DHaXQRKd3Ox8h5eqrevFS8MCP9qAAcH-SObR60-Fr10WbVBRokfzlwM3Og2jtA_Qluadpho8p3z3-OHzEkxRaQxIhuJrxaEiq505kh7FvnyTZ_ugJKE6Ge1VLqksu96fjj8nOfQ"
                alt="Poulet DG doré & Bissap frais pressé par nos chefs de campus"
                loading="lazy"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.2) 50%, transparent 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  padding: '1rem',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    background: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(4px)',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    width: 'fit-content',
                    marginBottom: '0.35rem',
                  }}
                >
                  Plat du jour signature
                </span>
                <span
                  style={{
                    color: '#ffffff',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    lineHeight: 1.3,
                  }}
                >
                  Poulet DG doré &amp; Bissap frais pressé
                </span>
              </div>
            </div>

            {/* Badges de réassurance en bas de carte */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '0.65rem',
                marginTop: '0.75rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: '#f6f3ec',
                  border: '1px solid #e5e2db',
                  borderRadius: '10px',
                  padding: '0.65rem 0.75rem',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#cfbd97',
                    color: '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  ★
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1c1c18', lineHeight: 1.2 }}>
                    15 points = 3 000 FC
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#5f5a4e' }}>
                    Réduction immédiate
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: '#f6f3ec',
                  border: '1px solid #e5e2db',
                  borderRadius: '10px',
                  padding: '0.65rem 0.75rem',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#1c1c18',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  ⚡
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1c1c18', lineHeight: 1.2 }}>
                    Zéro attente
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#5f5a4e' }}>
                    Retrait prioritaire
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Formulaire de connexion */}
        <div className="login-card" style={{ width: '100%', margin: 0 }}>
          <header className="login-header">
            <h1 className="brand-title" style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Connexion</h1>
            <p className="subtitle" style={{ fontSize: '0.95rem' }}>Heureux de vous retrouver à table.</p>
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