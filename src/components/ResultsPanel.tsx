import { Stat } from './ui';
import type { HeatExchangerResult } from '../lib/heatExchanger';

function fmt(value: number, decimals = 3): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtInt(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

interface ResultsPanelProps {
  result: HeatExchangerResult;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  if (!result.valid || !result.lmtd || !result.duty) {
    return (
      <div className="results results--empty" data-testid="results-empty">
        <p className="results__message">
          Results are suppressed until the highlighted inputs are corrected.
        </p>
        <ul className="results__errors">
          {result.errors.map((error, index) => (
            <li key={`${error.field}-${index}`}>{error.message}</li>
          ))}
        </ul>
      </div>
    );
  }

  const { lmtd: lmtdResult, duty } = result;
  const area = result.area;
  const hasCold = duty.Q_cold !== null;

  return (
    <div className="results" data-testid="results">
      <div className="stat-grid">
        <Stat
          label="Required area"
          value={area === null ? '—' : fmt(area, 5)}
          unit="m²"
          tone="neutral"
          hint="Sized from the hot-stream duty"
          testId="stat-area"
        />
        <Stat
          label="Heat duty (hot side)"
          value={fmtInt(duty.Q_hot)}
          unit="W"
          tone="hot"
          hint="Q_hot = ṁ_hot·cp_hot·(Th_in − Th_out)"
          testId="stat-qhot"
        />
        <Stat
          label="Heat duty (cold side)"
          value={hasCold ? fmtInt(duty.Q_cold as number) : '—'}
          unit="W"
          tone="cold"
          hint={hasCold ? 'Q_cold = ṁ_cold·cp_cold·(Tc_out − Tc_in)' : 'Cold-side data not supplied'}
          testId="stat-qcold"
        />
        <Stat
          label="LMTD"
          value={fmt(lmtdResult.lmtd, 5)}
          unit="K"
          tone="neutral"
          hint={
            lmtdResult.usedLimitingValue
              ? 'Equal terminal differences — limiting value used'
              : 'dT1, dT2 from the flow arrangement'
          }
          testId="stat-lmtd"
        />
        <Stat
          label="Terminal differences"
          value={`${fmt(lmtdResult.dT1, 2)} / ${fmt(lmtdResult.dT2, 2)}`}
          unit="K"
          tone="neutral"
          hint="dT1 / dT2"
        />
        <Stat
          label="Effective U·F"
          value={fmt(result.effectiveCoefficient, 2)}
          unit="W/(m²·K)"
          tone="neutral"
          hint="U multiplied by the correction factor"
        />
      </div>

      {hasCold ? (
        <div
          className={`balance ${duty.energyBalanceOk ? 'balance--ok' : 'balance--warn'}`}
          data-testid="balance"
        >
          <div className="balance__head">
            <span className="balance__title">Cold-side energy balance</span>
            <span className="balance__value" data-testid="mismatch">
              {fmt(duty.mismatchPercent ?? 0, 2)}% mismatch
            </span>
          </div>
          <p className="balance__text">
            {duty.energyBalanceOk ? (
              <>
                The hot and cold duties agree within the {fmt(duty.mismatchTolerancePercent, 0)}%
                tolerance. The area is sized from <strong>Q_hot</strong>; the two duties are
                reported separately and are never averaged.
              </>
            ) : (
              <>
                The two duties disagree by {fmt(duty.mismatchPercent ?? 0, 2)}%, which exceeds the{' '}
                {fmt(duty.mismatchTolerancePercent, 0)}% tolerance. They are{' '}
                <strong>not</strong> averaged: the required area below is sized from{' '}
                <strong>Q_hot</strong> only. Check the cold-side mass flow, specific heat and
                temperatures, and whether heat loss or phase change is being neglected.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="balance balance--muted">
          <div className="balance__head">
            <span className="balance__title">Cold-side energy balance</span>
            <span className="balance__value">Not available</span>
          </div>
          <p className="balance__text">
            Enter the cold-stream mass flow and specific heat to cross-check Q_cold against Q_hot.
            The area is sized from the hot-stream duty.
          </p>
        </div>
      )}

      {duty.zeroDuty ? (
        <p className="notice" data-testid="zero-duty">
          Zero-duty case: the hot stream transfers no heat, so the required area tends to zero.
          Check the inlet and outlet temperatures.
        </p>
      ) : null}
    </div>
  );
}
