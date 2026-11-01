// Composants de présentation partagés : conserver les props communes du brouillon.
import { cloneElement, useId, useRef } from 'react';
import type { HTMLAttributes, InputHTMLAttributes, ReactElement, ReactNode, SelectHTMLAttributes } from 'react';

export type FeedbackKind = 'error' | 'success' | 'info';

export function Alert({ kind = 'error', children }: { kind?: FeedbackKind; children: ReactNode }) {
  if (children === null || children === undefined || children === false || children === '') return null;
  return <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return <div className="spinner" role="status" aria-label={label}>
    <span className="spinner-icon" aria-hidden="true" />
    <span aria-hidden="true">{label}</span>
  </div>;
}

interface FieldControlProps extends Pick<HTMLAttributes<HTMLElement>, 'id' | 'aria-describedby' | 'aria-invalid' | 'aria-errormessage'> {}

export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: ReactElement<FieldControlProps>;
}

/** Un seul contrôle qui transmet id et aria-* à son élément HTML natif. */
export function Field({ label, error, hint, children }: FieldProps) {
  const generatedId = useId();
  const id = children.props.id ?? `field-${generatedId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [children.props['aria-describedby'], hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;
  return <div className="field">
    <label className="field-label" htmlFor={id}>{label}</label>
    {cloneElement(children, {
      id,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : children.props['aria-invalid'],
      'aria-errormessage': error ? errorId : children.props['aria-errormessage'],
    })}
    {hint && <small className="muted" id={hintId}>{hint}</small>}
    {error && <small className="field-error" id={errorId}>{error}</small>}
  </div>;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & Omit<FieldProps, 'children'>;
export function Input({ label, error, hint, ...props }: InputProps) {
  return <Field label={label} error={error} hint={hint}><input {...props} /></Field>;
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & Omit<FieldProps, 'children'>;
export function Select({ label, error, hint, children, ...props }: SelectProps) {
  return <Field label={label} error={error} hint={hint}><select {...props}>{children}</select></Field>;
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  const titleId = useId();
  return <section className="card" aria-labelledby={title ? titleId : undefined}>
    {(title || actions) && <header className="card-head">
      {title && <h2 id={titleId}>{title}</h2>}
      {actions}
    </header>}
    {children}
  </section>;
}

export function Badge({ kind = 'info', children }: { kind?: FeedbackKind | 'neutral'; children: ReactNode }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export interface TabOption<T extends string> {
  id: T;
  label: string;
  content?: ReactNode;
}
export interface TabsProps<T extends string> {
  value: T;
  options: TabOption<T>[];
  onChange: (value: T) => void;
  label?: string;
}

/** Contrôlé par le parent ; les flèches, Début et Fin activent l’onglet ciblé. */
export function Tabs<T extends string>({ value, options, onChange, label = 'Onglets' }: TabsProps<T>) {
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, options.findIndex(option => option.id === value));
  // Les appels du brouillon sans contenu restent compatibles : leurs panneaux sont externes.
  const hasPanels = options.some(option => option.content !== undefined);
  return <div className="tab-group">
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((option, index) => <button
        key={option.id}
        ref={element => { buttons.current[index] = element; }}
        id={`${id}-tab-${index}`}
        type="button"
        role="tab"
        aria-selected={index === selected}
        aria-controls={hasPanels ? `${id}-panel-${index}` : undefined}
        tabIndex={index === selected ? 0 : -1}
        className={index === selected ? 'tab active' : 'tab'}
        onClick={() => onChange(option.id)}
        onKeyDown={event => {
          let next: number;
          switch (event.key) {
            case 'ArrowRight': next = (index + 1) % options.length; break;
            case 'ArrowLeft': next = (index - 1 + options.length) % options.length; break;
            case 'Home': next = 0; break;
            case 'End': next = options.length - 1; break;
            default: return;
          }
          event.preventDefault();
          buttons.current[next]?.focus();
          onChange(options[next].id);
        }}
      >{option.label}</button>)}
    </div>
    {hasPanels && options.map((option, index) => <div
      key={option.id}
      id={`${id}-panel-${index}`}
      role="tabpanel"
      aria-labelledby={`${id}-tab-${index}`}
      tabIndex={0}
      hidden={index !== selected}
    >{option.content}</div>)}
  </div>;
}
