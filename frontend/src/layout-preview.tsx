import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { LayoutView } from './views/components/Layout.tsx';
import { Card, Select } from './views/components/ui.tsx';
import type { User } from './models/types.ts';
import './views/styles.css';
function Preview() {
  const [role, setRole] = useState<User['role']>('student');
  return <MemoryRouter><LayoutView role={role} restaurant={{ slug: 'campus', name: 'ZeDuc@Space', colors: { primary: 'var(--mm-color-primary)', secondary: 'var(--mm-color-secondary)' } }} onLogout={() => setRole(undefined)}>
    <div className="ui-hero"><p className="eyebrow">Mon Miam Miam · E-6</p><h1>Votre restaurant,<br />votre espace.</h1><p>Une navigation adaptée à chaque rôle.</p></div>
    <Card title="Aperçu de la navigation">
      <Select label="Rôle à prévisualiser" value={role ?? ''} onChange={event => setRole(event.target.value ? event.target.value as User['role'] : undefined)}>
        <option value="">Visiteur</option><option value="student">Étudiant</option><option value="employee">Employé</option><option value="manager">Gérant</option><option value="admin">Administrateur restaurant</option><option value="platform_admin">Administrateur plateforme</option>
      </Select>
      <p>Ouvrez le menu sur téléphone ou choisissez un autre rôle pour comparer les liens. Les données de cet aperçu sont fictives.</p>
    </Card>
  </LayoutView></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
