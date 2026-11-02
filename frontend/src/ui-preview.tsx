// Aperçu de développement indépendant de la navigation de l’application (E-6).
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Badge, Card, Empty, Field, Input, Select, Spinner, Tabs } from './views/components/ui.tsx';
import './views/styles.css';

function UiPreview() {
  const [tab, setTab] = useState('plats');
  const [notice, setNotice] = useState(false);
  return <main className="content">
    <header className="ui-hero">
      <p className="eyebrow">Mon Miam Miam · E-5</p>
      <h1>Une même table,<br />une même identité.</h1>
      <p>Charte graphique et composants de base</p>
      <div className="ui-swatches">
        <div className="ui-swatch ui-swatch-primary">Beige · couleur principale</div>
        <div className="ui-swatch ui-swatch-secondary">Noir · couleur secondaire</div>
      </div>
    </header>
    <div className="two">
      <div className="stack">
        <Card title="Des champs clairs">
          <form onSubmit={event => { event.preventDefault(); setNotice(true); }}>
            <Input label="Votre nom" autoComplete="name" placeholder="Emmanuel" required />
            <Input label="Adresse e-mail" type="email" defaultValue="emmanuel@" error="Saisissez une adresse e-mail complète." />
            <Select label="Restaurant" defaultValue="campus" hint="Votre panier reste lié au restaurant choisi.">
              <option value="campus">Restaurant du campus</option><option value="mini">Mini Délice</option>
            </Select>
            <Field label="Note pour le restaurant" hint="Facultatif, 200 caractères maximum.">
              <textarea rows={2} maxLength={200} placeholder="Un peu moins de sauce, s’il vous plaît." />
            </Field>
            <div className="row"><button className="btn-primary" type="submit">Enregistrer</button><button type="button" disabled>Indisponible</button></div>
          </form>
        </Card>
        <Card title="Messages et chargement">
          <div className="stack">
            <Alert kind="info">Choisissez un restaurant pour découvrir sa carte.</Alert>
            <Alert kind="success">Votre choix a bien été enregistré.</Alert>
            <Alert>Le menu n’a pas pu être chargé. Réessayez.</Alert>
            <Spinner label="Chargement de la carte…" />
          </div>
        </Card>
      </div>
      <div className="stack">
        <Card title="La carte du jour" actions={<Badge kind="success">Ouvert</Badge>}>
          <Tabs label="Catégories du menu" value={tab} onChange={setTab} options={[
            { id: 'plats', label: 'Plats', content: <div className="stack">
              <div><h3>Poulet mayonnaise</h3><p className="muted">Poulet préparé à la congolaise, avec une sauce onctueuse.</p><div className="row"><strong>3 500 FC</strong><Badge kind="success">Disponible</Badge></div></div>
              <div><h3>Pondu</h3><p className="muted">Feuilles de manioc mijotées à la congolaise.</p><div className="row"><strong>2 500 FC</strong><Badge kind="neutral">Épuisé</Badge></div></div>
              <button type="button" className="btn-primary" onClick={() => setNotice(true)}>Ajouter au panier de démonstration</button>
            </div> },
            { id: 'boissons', label: 'Boissons', content: <div className="stack"><h3>Coca-Cola, Fanta, Vital’O</h3><p className="muted">Servis bien frais.</p><strong>800 FC · prix d’exemple</strong></div> },
            { id: 'desserts', label: 'Desserts', content: <Empty>Aucun dessert disponible aujourd’hui.</Empty> },
          ]} />
          {notice && <Alert kind="success">Action de démonstration enregistrée.</Alert>}
        </Card>
        <Card title="Un état vide, une prochaine étape">
          <Empty><p>Votre panier attend ses premières saveurs.</p><button type="button" onClick={() => { setTab('plats'); setNotice(false); }}>Découvrir les plats</button></Empty>
        </Card>
        <Card title="Boutons et statuts">
          <div className="stack">
            <div className="row"><button className="btn-primary" onClick={() => setNotice(true)}>Action principale</button><button className="btn-dark" onClick={() => setNotice(true)}>Action secondaire</button></div>
            <div className="row"><Badge kind="info">En préparation</Badge><Badge kind="success">Prête</Badge><Badge kind="error">Annulée</Badge></div>
            <p className="muted">Les états restent compréhensibles grâce à leur libellé.</p>
          </div>
        </Card>
      </div>
    </div>
    <footer className="ui-caption">Aperçu de développement · Poppins · Données de démonstration</footer>
  </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><UiPreview /></StrictMode>);
