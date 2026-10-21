import { useMemo } from 'react';
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
import { areaForF, type HeatExchangerInputs, type HeatExchangerResult } from '../lib/heatExchanger';

interface Props {
  inputs: HeatExchangerInputs;
  result: HeatExchangerResult;
}

/**
 * Required area as a function of the correction factor F.
 * F is restricted to 0 < F <= 1 as required by the model.
 */
export function AreaVsFChart({ inputs, result }: Props) {
  const { points, currentArea, currentF } = useMemo(() => {
    const list: { F: number; area: number | null }[] = [];
    const steps = 100;
    for (let i = 1; i <= steps; i += 1) {
      const f = i / steps; // 0.01 .. 1.00, never 0
      list.push({ F: f, area: areaForF(inputs, f) });
    }
    return {
      points: list,
      currentArea: result.valid ? result.area : null,
      currentF: inputs.correctionFactor,
    };
  }, [inputs, result]);

  const valid = result.valid && currentArea !== null;

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points} margin={{ top: 12, right: 18, bottom: 28, left: 4 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="F"
            type="number"
            domain={[0, 1]}
            ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            stroke={COLORS.navyMuted}
            fontSize={11}
            label={{
              value: 'Correction factor F (dimensionless, 0 < F ≤ 1)',
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
            labelFormatter={(value: number) => `F = ${Number(value).toFixed(2)}`}
          />
          <Line
            type="monotone"
            dataKey="area"
            stroke={COLORS.accent}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
            name="Required area"
          />
          {valid ? (
            <ReferenceDot
              x={currentF}
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
        F is supplied by you — ThermoLab does not derive a shell-and-tube correction factor
        (LMTD correction, R, P, Z) because the geometry and arrangement data needed for it are not
        part of this model. Sweep 0 &lt; F ≤ 1 only; F = 0 would imply an infinite area.
      </p>
    </div>
  );
}
