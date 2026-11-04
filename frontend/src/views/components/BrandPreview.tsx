import { assetUrl } from '../../models/http.ts';
import { PAGE_BACKGROUNDS, isHexColor, isVisibleOn, readableOn } from '../../models/color.ts';

interface BrandPreviewProps {
  name: string;
  logoUrl: string | null;
  primary: string;
  secondary: string;
  fontFamily: string;
}

/** Aperçu en direct de la charte : en-tête, bouton et alerte de lisibilité, avant d'enregistrer. */
export function BrandPreview({ name, logoUrl, primary, secondary, fontFamily }: BrandPreviewProps) {
  const valid = isHexColor(primary) && isHexColor(secondary);
  if (!valid) return <p className="muted">L’aperçu s’affiche dès que les deux couleurs sont valides.</p>;
  // Le bandeau et le bouton choisissent seuls un texte noir ou blanc ; seuls les textes en couleur principale peuvent disparaître sur la page.
  const invisibleOn = (['light', 'dark'] as const).filter(mode => !isVisibleOn(primary, PAGE_BACKGROUNDS[mode]));
  return <div className="brand-preview" aria-label="Aperçu de la charte" style={{ fontFamily: `'${fontFamily}', 'Segoe UI', system-ui, sans-serif` }}>
    <div className="brand-preview-header" style={{ background: secondary, color: readableOn(secondary) }}>
      {logoUrl ? <img src={assetUrl(logoUrl)} alt={`Logo de ${name}`} /> : <strong>{name || 'Mon restaurant'}</strong>}
      <span>Menu · Panier · Mes commandes</span>
    </div>
    <div className="brand-preview-body">
      <button type="button" tabIndex={-1} style={{ background: primary, color: readableOn(primary) }}>Commander</button>
      <span style={{ color: primary }}>Lien et prix en couleur principale</span>
    </div>
    {invisibleOn.map(mode => <p key={mode} role="status" className="brand-preview-warning">
      La couleur principale se confond presque avec le fond {mode === 'light' ? 'blanc du mode clair' : 'sombre du mode sombre'} : liens et prix y seront difficiles à voir.
    </p>)}
  </div>;
}
