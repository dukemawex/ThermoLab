import type { HeatExchangerInputs, HeatExchangerResult } from '../lib/heatExchanger';

function n(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return String(Number(value.toFixed(decimals)));
}

/**
 * Shows the calculation with the numbers substituted in, step by step.
 * Every step is derived from the actual inputs so the panel can never drift
 * out of sync with the result cards.
 */
export function WorkedCalculation({
  inputs,
  result,
}: {
  inputs: HeatExchangerInputs;
  result: HeatExchangerResult;
}) {
  if (!result.valid || !result.lmtd || !result.duty) {
    return (
      <div className="worked" data-testid="worked-empty">
        <p className="worked__message">
          The worked calculation appears once the inputs are valid.
        </p>
      </div>
    );
  }

  const { lmtd: lmtdResult, duty } = result;
  const isCounter = inputs.arrangement === 'counter';
  const dT1Expr = isCounter
    ? 'Th,in − Tc,out'
    : 'Th,in − Tc,in';
  const dT2Expr = isCounter
    ? 'Th,out − Tc,in'
    : 'Th,out − Tc,out';
  const dT1Values = isCounter
    ? `${n(inputs.hotInlet)} − ${n(inputs.coldOutlet)}`
    : `${n(inputs.hotInlet)} − ${n(inputs.coldInlet)}`;
  const dT2Values = isCounter
    ? `${n(inputs.hotOutlet)} − ${n(inputs.coldInlet)}`
    : `${n(inputs.hotOutlet)} − ${n(inputs.coldOutlet)}`;

  const area = result.area;

  return (
    <div className="worked" data-testid="worked">
      <ol className="worked__steps">
        <li className="worked__step">
          <span className="worked__title">1. Hot-side heat duty</span>
          <code className="worked__expr">
            Q_hot = ṁ_hot · cp_hot · (Th,in − Th,out)
          </code>
          <code className="worked__expr worked__expr--num">
            = {n(inputs.hotMassFlow)} kg/s × {n(inputs.hotCp)} J/(kg·K) × ({n(inputs.hotInlet)} −{' '}
            {n(inputs.hotOutlet)}) K
          </code>
          <code className="worked__expr worked__expr--result">
            = {n(duty.Q_hot, 1)} W
          </code>
        </li>

        <li className="worked__step">
          <span className="worked__title">
            2. Terminal differences ({isCounter ? 'counterflow' : 'parallel flow'})
          </span>
          <code className="worked__expr">
            ΔT1 = {dT1Expr} = {dT1Values} = {n(lmtdResult.dT1)} K
          </code>
          <code className="worked__expr">
            ΔT2 = {dT2Expr} = {dT2Values} = {n(lmtdResult.dT2)} K
          </code>
        </li>

        <li className="worked__step">
          <span className="worked__title">3. Log-mean temperature difference</span>
          {lmtdResult.usedLimitingValue ? (
            <>
              <code className="worked__expr">
                LMTD = (ΔT1 − ΔT2) / ln(ΔT1 / ΔT2)
              </code>
              <code className="worked__expr worked__expr--note">
                ΔT1 and ΔT2 are equal, so the stable limiting value is used:
              </code>
              <code className="worked__expr worked__expr--num">
                = (ΔT1 + ΔT2) / 2 = ({n(lmtdResult.dT1)} + {n(lmtdResult.dT2)}) / 2
              </code>
              <code className="worked__expr worked__expr--result">
                = {n(lmtdResult.lmtd, 5)} K
              </code>
            </>
          ) : (
            <>
              <code className="worked__expr">
                LMTD = (ΔT1 − ΔT2) / ln(ΔT1 / ΔT2)
              </code>
              <code className="worked__expr worked__expr--num">
                = ({n(lmtdResult.dT1)} − {n(lmtdResult.dT2)}) / ln({n(lmtdResult.dT1)} /{' '}
                {n(lmtdResult.dT2)})
              </code>
              <code className="worked__expr worked__expr--result">
                = {n(lmtdResult.lmtd, 5)} K
              </code>
            </>
          )}
        </li>

        {duty.Q_cold !== null ? (
          <li className="worked__step">
            <span className="worked__title">4. Cold-side heat duty (cross-check)</span>
            <code className="worked__expr">
              Q_cold = ṁ_cold · cp_cold · (Tc,out − Tc,in)
            </code>
            <code className="worked__expr worked__expr--num">
              = {n(inputs.coldMassFlow ?? NaN)} kg/s × {n(inputs.coldCp ?? NaN)} J/(kg·K) × (
              {n(inputs.coldOutlet)} − {n(inputs.coldInlet)}) K
            </code>
            <code className="worked__expr worked__expr--result">
              = {n(duty.Q_cold, 1)} W
            </code>
            <code className="worked__expr worked__expr--note">
              Mismatch = |Q_hot − Q_cold| / max(|Q_hot|, |Q_cold|) × 100 ={' '}
              {n(duty.mismatchPercent ?? 0, 2)}% (tolerance{' '}
              {n(duty.mismatchTolerancePercent, 0)}%)
            </code>
          </li>
        ) : null}

        <li className="worked__step">
          <span className="worked__title">
            {duty.Q_cold !== null ? '5' : '4'}. Required heat-transfer area
          </span>
          <code className="worked__expr">A = Q_hot / (U · F · LMTD)</code>
          <code className="worked__expr worked__expr--num">
            = {n(duty.Q_hot, 1)} W / ({n(inputs.U)} W/(m²·K) × {n(inputs.correctionFactor)} ×{' '}
            {n(lmtdResult.lmtd, 5)} K)
          </code>
          <code className="worked__expr worked__expr--result">
            = {area === null ? '—' : `${n(area, 5)}`} m²
          </code>
          <code className="worked__expr worked__expr--note">
            The area is sized from the hot-stream duty Q_hot. The cold-side duty is reported for
            comparison only and is never averaged into the sizing basis.
          </code>
        </li>
      </ol>
    </div>
  );
}
