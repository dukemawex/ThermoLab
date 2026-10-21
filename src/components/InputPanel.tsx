import { NumberField } from './NumberField';
import {
  DEFAULT_EXAMPLE,
  type FlowArrangement,
  type HeatExchangerInputs,
  type FieldError,
} from '../lib/heatExchanger';

interface InputPanelProps {
  inputs: HeatExchangerInputs;
  errors: FieldError[];
  onChange: (patch: Partial<HeatExchangerInputs>) => void;
  onLoadExample: () => void;
  onReset: () => void;
}

function errorFor(errors: FieldError[], field: keyof HeatExchangerInputs): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

export function InputPanel({
  inputs,
  errors,
  onChange,
  onLoadExample,
  onReset,
}: InputPanelProps) {
  const arrangementError = errorFor(errors, 'arrangement');

  return (
    <div className="panel">
      <div className="panel__section">
        <h3 className="panel__heading">
          <span className="swatch swatch--hot" aria-hidden="true" />
          Hot stream
        </h3>
        <div className="grid grid--2">
          <NumberField
            label="Hot inlet temp"
            unit="°C"
            value={inputs.hotInlet}
            onChange={(v) => onChange({ hotInlet: v })}
            error={errorFor(errors, 'hotInlet')}
            testId="hot-inlet"
          />
          <NumberField
            label="Hot outlet temp"
            unit="°C"
            value={inputs.hotOutlet}
            onChange={(v) => onChange({ hotOutlet: v })}
            error={errorFor(errors, 'hotOutlet')}
            testId="hot-outlet"
          />
          <NumberField
            label="Hot mass flow"
            unit="kg/s"
            step={0.1}
            value={inputs.hotMassFlow}
            onChange={(v) => onChange({ hotMassFlow: v })}
            error={errorFor(errors, 'hotMassFlow')}
            testId="hot-mass-flow"
          />
          <NumberField
            label="Hot specific heat"
            unit="J/(kg·K)"
            step={10}
            value={inputs.hotCp}
            onChange={(v) => onChange({ hotCp: v })}
            error={errorFor(errors, 'hotCp')}
            testId="hot-cp"
          />
        </div>
      </div>

      <div className="panel__section">
        <h3 className="panel__heading">
          <span className="swatch swatch--cold" aria-hidden="true" />
          Cold stream
        </h3>
        <div className="grid grid--2">
          <NumberField
            label="Cold inlet temp"
            unit="°C"
            value={inputs.coldInlet}
            onChange={(v) => onChange({ coldInlet: v })}
            error={errorFor(errors, 'coldInlet')}
            testId="cold-inlet"
          />
          <NumberField
            label="Cold outlet temp"
            unit="°C"
            value={inputs.coldOutlet}
            onChange={(v) => onChange({ coldOutlet: v })}
            error={errorFor(errors, 'coldOutlet')}
            testId="cold-outlet"
          />
          <NumberField
            label="Cold mass flow"
            unit="kg/s"
            step={0.1}
            allowEmpty
            placeholder="optional"
            value={inputs.coldMassFlow ?? NaN}
            onChange={(v) => onChange({ coldMassFlow: Number.isNaN(v) ? undefined : v })}
            error={errorFor(errors, 'coldMassFlow')}
            hint="Leave blank to skip the cold-side energy balance."
            testId="cold-mass-flow"
          />
          <NumberField
            label="Cold specific heat"
            unit="J/(kg·K)"
            step={10}
            allowEmpty
            placeholder="optional"
            value={inputs.coldCp ?? NaN}
            onChange={(v) => onChange({ coldCp: Number.isNaN(v) ? undefined : v })}
            error={errorFor(errors, 'coldCp')}
            testId="cold-cp"
          />
        </div>
      </div>

      <div className="panel__section">
        <h3 className="panel__heading">Exchanger</h3>
        <div className="grid grid--2">
          <div className="field">
            <span className="field__label" id="arrangement-label">
              Flow arrangement
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="arrangement-label">
              {(
                [
                  { id: 'counter', label: 'Counterflow' },
                  { id: 'parallel', label: 'Parallel flow' },
                ] as { id: FlowArrangement; label: string }[]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={inputs.arrangement === option.id}
                  data-testid={`arrangement-${option.id}`}
                  className={`segmented__btn ${
                    inputs.arrangement === option.id ? 'is-active' : ''
                  }`.trim()}
                  onClick={() => onChange({ arrangement: option.id })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <NumberField
            label="U overall"
            unit="W/(m²·K)"
            step={10}
            value={inputs.U}
            onChange={(v) => onChange({ U: v })}
            error={errorFor(errors, 'U')}
            testId="u-value"
          />
          <NumberField
            label="Correction factor F"
            unit="–"
            step={0.05}
            min={0.0001}
            max={1}
            value={inputs.correctionFactor}
            onChange={(v) => onChange({ correctionFactor: v })}
            error={errorFor(errors, 'correctionFactor')}
            hint="User-supplied. 0 < F ≤ 1."
            testId="correction-factor"
          />
        </div>
        {arrangementError ? (
          <p className="field__error" role="alert">
            {arrangementError}
          </p>
        ) : null}
      </div>

      <div className="panel__section panel__section--actions">
        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={onLoadExample} data-testid="load-example">
            Load example
          </button>
          <button
            type="button"
            className="btn"
            onClick={onReset}
            data-testid="reset"
            title={`Restore the default example values (${DEFAULT_EXAMPLE.U} W/(m²·K), counterflow)`}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
