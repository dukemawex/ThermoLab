import { useEffect, useId, useRef, useState } from 'react';
import { FieldError } from './ui';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  error?: string;
  hint?: string;
  allowEmpty?: boolean;
  placeholder?: string;
  /** aria label override for tests */
  testId?: string;
}

/**
 * A large, touch-friendly numeric input.
 *
 * A number input is awkward to drive directly: browsers report an empty
 * `value` for partially typed input such as "-" or "1.", and a fully
 * controlled `value={String(n)}` fights the user's cursor by reformatting on
 * every keystroke. So the field keeps the raw text the user typed and only
 * pushes a parsed number upwards, while still reflecting values that changed
 * from the outside (reset, load example, restored from localStorage).
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
  error,
  hint,
  allowEmpty = false,
  placeholder,
  testId,
}: NumberFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const isInvalid = Boolean(error);

  const format = (v: number) =>
    v === undefined || v === null || Number.isNaN(v) ? '' : String(v);

  const [text, setText] = useState(() => format(value));
  // The last number we emitted upwards. When the incoming prop matches it, the
  // change originated here and the raw text must be left alone.
  const lastEmitted = useRef<number>(value);

  useEffect(() => {
    // Object.is, not ===, so that NaN (an empty or unparseable field) is
    // treated as "unchanged" and the raw text the user typed survives.
    if (Object.is(value, lastEmitted.current)) {
      return;
    }
    // The value was changed externally (reset, example load, restore).
    setText(format(value));
    lastEmitted.current = value;
  }, [value]);

  const describedBy = [isInvalid ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  const handleChange = (raw: string) => {
    setText(raw);
    if (raw === '') {
      // An empty field is only meaningful for optional inputs. Required
      // inputs report NaN so the validator can flag them.
      const emitted = allowEmpty ? NaN : NaN;
      lastEmitted.current = emitted;
      onChange(emitted);
      return;
    }
    const parsed = Number(raw);
    const emitted = Number.isNaN(parsed) ? NaN : parsed;
    lastEmitted.current = emitted;
    onChange(emitted);
  };

  return (
    <div className={`field ${isInvalid ? 'field--invalid' : ''}`.trim()}>
      <label className="field__label" htmlFor={id}>
        {label}
        {unit ? <span className="field__unit">{unit}</span> : null}
      </label>
      <input
        id={id}
        data-testid={testId}
        className="field__input"
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={text}
        placeholder={placeholder}
        aria-invalid={isInvalid}
        aria-describedby={describedBy || undefined}
        onChange={(event) => handleChange(event.target.value)}
      />
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <FieldError message={error} />
    </div>
  );
}
