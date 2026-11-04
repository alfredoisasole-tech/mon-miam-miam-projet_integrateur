import { useId } from 'react';
import { hexToRgb, rgbToHex, type Rgb } from '../../models/color.ts';

interface ColorFieldProps {
  label: string;
  value: string;
  error?: string;
  hint?: string;
  onChange: (hex: string) => void;
}

const CHANNELS = ['Rouge', 'Vert', 'Bleu'] as const;

/** Choix d'une couleur sans connaître les codes : palette, trois curseurs de 0 à 255 (rouge, vert, bleu) ou code #rrggbb, toujours synchronisés. */
export function ColorField({ label, value, error, hint, onChange }: ColorFieldProps) {
  const id = useId();
  const rgb: Rgb | null = hexToRgb(value);
  const setChannel = (index: number, text: string) => {
    const next: Rgb = [...(rgb ?? [0, 0, 0])] as Rgb;
    next[index] = Number(text);
    onChange(rgbToHex(next));
  };
  return <fieldset className="color-field" aria-describedby={error ? `${id}-error` : undefined}>
    <legend>{label}</legend>
    <div className="color-field-row">
      <input className="color-swatch" type="color" aria-label={`${label} : palette`} value={rgb ? value.toLowerCase() : '#000000'} onChange={event => onChange(event.target.value)} />
      <label className="color-code">Code
        <input type="text" aria-label={label} value={value} spellCheck={false} maxLength={7} aria-invalid={error ? true : undefined} onChange={event => onChange(event.target.value.trim())} />
      </label>
      {CHANNELS.map((channel, index) => <label key={channel} className="color-channel">{channel}
        <input type="number" min={0} max={255} aria-label={`${label} : ${channel.toLowerCase()} (0 à 255)`} value={rgb ? rgb[index] : ''} onChange={event => setChannel(index, event.target.value)} />
      </label>)}
    </div>
    {hint && !error && <p className="muted">{hint}</p>}
    {error && <p id={`${id}-error`} role="alert" className="field-error">{error}</p>}
  </fieldset>;
}
