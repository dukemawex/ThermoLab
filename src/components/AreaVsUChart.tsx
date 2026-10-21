import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { COLORS } from '../lib/theme';
import { areaForU, type HeatExchangerInputs, type HeatExchangerResult } from '../lib/heatExchanger';

interface Props {
  inputs: HeatExchangerInputs;
  result: HeatExchangerResult;
}

function niceStep(range: number): number {
  if (range <= 0) return 1;
  const rough = range / 40;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  let step: number;
  if (normalised <= 1) step = 1;
  else if (normalised <= 2) step = 2;
  else if (normalised <= 5) step = 5;
  else step = 10;
  return step * magnitude;
}

/** Required area as a function of U, with an adjustable sweep range. */
export function AreaVsUChart({ inputs, result }: Props) {
  const [maxU, setMaxU] = useState(() => Math.max(Math.round(inputs.U * 3), 500));

  const { points, step, sweepMax, currentArea, currentU } = useMemo(() => {
    const u = inputs.U > 0 ? inputs.U : 100;
    // The sweep always covers the slider range, and extends a little past the
    // current U so the operating point is never at the very edge of the plot.
    const cap = Math.max(maxU, Math.ceil(u * 1.05), 10);
    const s = niceStep(cap);
    const list: { U: number; area: number | null }[] = [];
    for (let v = s; v <= cap + 1e-9; v += s) {
      list.push({ U: Number(v.toFixed(6)), area: areaForU(inputs, v) });
    }
    return {
      points: list,
      step: s,
      sweepMax: cap,
      currentArea: result.valid ? result.area : null,
      currentU: u,
    };
  }, [inputs, maxU, result]);

  const valid = result.valid && currentArea !== null;

  return (
    <div className="chart">
      <div className="chart__controls">
        <label className="chart__control" htmlFor="u-range">
          <span>
            U range up to <strong>{maxU}</strong> W/(m²·K)
          </span>
          <input
            id="u-range"
            type="range"
            min={100}
            max={20000}
            step={100}
            value={maxU}
            onChange={(event) => setMaxU(Number(event.target.value))}
            data-testid="u-range"
          />
        </label>
        <span className="chart__readout">
          {valid
            ? `Current point: A = ${currentArea!.toFixed(4)} m² at U = ${currentU} W/(m²·K)`
            : 'Fix the inputs to plot the area curve.'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points} margin={{ top: 12, right: 18, bottom: 28, left: 4 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="U"
            type="number"
            domain={[0, sweepMax]}
            stroke={COLORS.navyMuted}
            fontSize={11}
            label={{
              value: 'Overall heat transfer coefficient U (W/(m²·K))',
              position: 'insideBottom',
              offset: -18,
              fill: COLORS.navy,
              fontSize: 12,
            }}
          />
          <YAxis
            stroke={COLORS.navyMuted}
            fontSize={11}
            width={52}
            unit=" m²"
            label={{
              value: 'Required area',
              angle: -90,
              position: 'insideLeft',
              fill: COLORS.navy,
              fontSize: 12,
            }}
          />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: `1px solid ${COLORS.grid}`, fontSize: 12 }}
            formatter={(value: number) => [`${Number(value).toFixed(4)} m²`, 'Required area']}
            labelFormatter={(value: number) => `U = ${Number(value)} W/(m²·K)`}
          />
          <Line
            type="monotone"
            dataKey="area"
            stroke={COLORS.cold}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
            name="Required area"
          />
          {valid ? (
            <ReferenceDot
              x={currentU}
              y={currentArea as number}
              r={6}
              fill={COLORS.hot}
              stroke="#fff"
              strokeWidth={2}
              isFront
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>

      <p className="chart__caption">
        Area varies as 1/U with everything else held constant. The highlighted point marks the
        current operating point (U = {currentU} W/(m²·K), sweep step {step} W/(m²·K)).
      </p>
    </div>
  );
}
