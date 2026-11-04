import { assetUrl } from '../../models/http.ts';

interface LogoFieldProps {
  logoUrl: string | null;
  pending: boolean;
  onPick: (file: File | undefined) => void;
  onRemove: () => void;
}

/** Logo du restaurant : aperçu sur fond à damier (pour voir les transparences), choix du fichier et retrait. */
export function LogoField({ logoUrl, pending, onPick, onRemove }: LogoFieldProps) {
  return <div className="logo-field">
    <div className="logo-field-preview">
      {logoUrl ? <img src={assetUrl(logoUrl)} alt="Logo actuel du restaurant" /> : <span className="muted">Aucun logo</span>}
    </div>
    <div className="logo-field-actions">
      <label className="btn">
        {logoUrl ? 'Remplacer le logo' : 'Importer un logo'}
        <input type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label="Fichier du logo" onChange={event => { onPick(event.target.files?.[0]); event.target.value = ''; }} />
      </label>
      {logoUrl && <button type="button" className="btn" onClick={onRemove}>Retirer le logo</button>}
      <p className="muted">PNG, JPEG ou WebP, 512 Ko au plus. Format conseillé : rectangulaire, environ 3 fois plus large que haut, fond transparent.</p>
      {pending && <p role="status" className="muted">Nouveau logo à enregistrer.</p>}
    </div>
  </div>;
}
