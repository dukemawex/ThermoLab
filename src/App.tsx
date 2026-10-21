import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from './components/ui';
import { InputPanel } from './components/InputPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { WorkedCalculation } from './components/WorkedCalculation';
import { TemperatureDiagram } from './components/TemperatureDiagram';
import { AreaVsUChart } from './components/AreaVsUChart';
import { AreaVsFChart } from './components/AreaVsFChart';
import {
  DEFAULT_EXAMPLE,
  calculate,
  type HeatExchangerInputs,
} from './lib/heatExchanger';
import { loadInputs, saveInputs, clearInputs } from './lib/storage';
import { buildCsv, downloadCsv } from './lib/csv';

const ASSUMPTIONS = [
  'Steady state',
  'Constant physical properties (no variation with temperature or phase)',
  'Negligible heat loss to the surroundings',
  'No phase change — sensible heat only',
  'The required area is sized from the hot-stream duty Q_hot',
];

export default function App() {
  const [inputs, setInputs] = useState<HeatExchangerInputs>(() => {
    return loadInputs() ?? { ...DEFAULT_EXAMPLE };
  });

  // Instant recalculation on every input change.
  const result = useMemo(() => calculate(inputs), [inputs]);

  // Persist inputs so the session survives a reload.
  useEffect(() => {
    saveInputs(inputs);
  }, [inputs]);

  const handleChange = useCallback((patch: Partial<HeatExchangerInputs>) => {
    setInputs((previous) => ({ ...previous, ...patch }));
  }, []);

  const handleLoadExample = useCallback(() => {
    setInputs({ ...DEFAULT_EXAMPLE });
  }, []);

  const handleReset = useCallback(() => {
    clearInputs();
    setInputs({ ...DEFAULT_EXAMPLE });
  }, []);

  const handleExport = useCallback(() => {
    const csv = buildCsv(inputs, result);
    downloadCsv('thermolab-results.csv', csv);
  }, [inputs, result]);

  const errorCount = result.errors.length;

  return (
    <div className="app">
      <header className="app__header no-print">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            TL
          </span>
          <div>
            <h1 className="app__title">ThermoLab</h1>
            <p className="app__tagline">
              Heat exchanger sizing for parallel-flow and counterflow exchangers. All calculations
              run locally in your browser.
            </p>
          </div>
        </div>
        <div className="app__header-actions">
          <button type="button" className="btn" onClick={handleExport} data-testid="export-csv">
            Export CSV
          </button>
          <button type="button" className="btn" onClick={() => window.print()} data-testid="print">
            Print
          </button>
        </div>
      </header>

      <main className="app__main">
        <div className="layout">
          <div className="layout__side">
            <Card
              title="Inputs"
              subtitle="Values update the results instantly."
              className="card--inputs"
            >
              <InputPanel
                inputs={inputs}
                errors={result.errors}
                onChange={handleChange}
                onLoadExample={handleLoadExample}
                onReset={handleReset}
              />
            </Card>

            <Card title="Model assumptions" className="card--assumptions no-print">
              <ul className="assumptions">
                {ASSUMPTIONS.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
              <p className="assumptions__note">
                The correction factor <strong>F</strong> is user-supplied (0 &lt; F ≤ 1). ThermoLab
                does not infer shell-and-tube LMTD correction factors from incomplete geometry.
              </p>
            </Card>
          </div>

          <div className="layout__main">
            {errorCount > 0 ? (
              <div className="alert no-print" role="alert" data-testid="error-summary">
                <strong>
                  {errorCount} input {errorCount === 1 ? 'problem' : 'problems'} found.
                </strong>{' '}
                Results and charts are suppressed until they are fixed.
              </div>
            ) : null}

            <Card title="Results" subtitle="Live values for the current input set.">
              <ResultsPanel result={result} />
            </Card>

            <Card
              title="Temperature diagram"
              subtitle="Hot and cold endpoint temperatures along the hot-flow direction."
            >
              <TemperatureDiagram inputs={inputs} result={result} />
            </Card>

            <Card
              title="Required area vs U"
              subtitle="How the required area responds to the overall heat-transfer coefficient."
            >
              <AreaVsUChart inputs={inputs} result={result} />
            </Card>

            <Card
              title="Required area vs F"
              subtitle="How the required area responds to the user-supplied correction factor."
            >
              <AreaVsFChart inputs={inputs} result={result} />
            </Card>

            <Card
              title="Worked calculation"
              subtitle="Every step with the current numbers substituted in."
            >
              <WorkedCalculation inputs={inputs} result={result} />
            </Card>
          </div>
        </div>
      </main>

      <footer className="app__footer no-print">
        <p>
          ThermoLab runs entirely offline in your browser. No account, no API key, no server-side
          calculation. Your inputs are stored only in this browser&apos;s localStorage.
        </p>
      </footer>
    </div>
  );
}
