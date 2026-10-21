import type { ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`.trim()}>
      <header className="card__head">
        <div>
          <h2 className="card__title">{title}</h2>
          {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="card__actions">{actions}</div> : null}
      </header>
      <div className="card__body">{children}</div>
    </section>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field__error" role="alert">
      {message}
    </p>
  );
}

export function Stat({
  label,
  value,
  unit,
  tone = 'neutral',
  hint,
  testId,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'neutral' | 'hot' | 'cold' | 'warn' | 'ok';
  hint?: string;
  testId?: string;
}) {
  return (
    <div className={`stat stat--${tone}`} data-testid={testId}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">
        {value}
        {unit ? <span className="stat__unit">{unit}</span> : null}
      </span>
      {hint ? <span className="stat__hint">{hint}</span> : null}
    </div>
  );
}
