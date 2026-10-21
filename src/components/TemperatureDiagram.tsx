import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { COLORS } from '../lib/theme';
import {
  temperatureDiagram,
  type HeatExchangerInputs,
  type HeatExchangerResult,
} from '../lib/heatExchanger';

interface Props {
  inputs: HeatExchangerInputs;
  result: HeatExchangerResult;
}

/**
 * Endpoint temperature diagram.
 *
 * The horizontal axis is the position along the hot-flow direction. The cold
 * endpoints are reversed for counter flow because the cold stream travels in
 * the opposite direction. The connecting straight lines are SCHEMATIC: they
 * simply join the known endpoint temperatures and are not a calculated
 * internal temperature profile.
 */
export function TemperatureDiagram({ inputs }: Props) {
  const data = temperatureDiagram(inputs);

  const rows = [
    {
      position: 0,
      hot: data.hot[0]?.temperature ?? 0,
      cold: data.cold[0]?.temperature ?? 0,
      hotLabel: data.hot[0]?.label ?? '',
      coldLabel: data.cold[0]?.label ?? '',
    },
    {
      position: 1,
      hot: data.hot[1]?.temperature ?? 0,
      cold: data.cold[1]?.temperature ?? 0,
      hotLabel: data.hot[1]?.label ?? '',
      coldLabel: data.cold[1]?.label ?? '',
    },
  ];

  const isCounter = inputs.arrangement === 'counter';

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 12, right: 18, bottom: 28, left: 4 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="position"
            type="number"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(v: number) => (v === 0 ? 'Inlet' : v === 1 ? 'Outlet' : v.toFixed(2))}
            stroke={COLORS.navyMuted}
            fontSize={11}
            label={{
              value: data.xAxisLabel,
              position: 'insideBottom',
              offset: -18,
              fill: COLORS.navy,
              fontSize: 12,
            }}
          />
          <YAxis
            stroke={COLORS.navyMuted}
            fontSize={11}
            width={46}
            unit=" °C"
            label={{
              value: 'Temperature',
              angle: -90,
              position: 'insideLeft',
              fill: COLORS.navy,
              fontSize: 12,
            }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: `1px solid ${COLORS.grid}`,
              fontSize: 12,
            }}
            labelFormatter={() => 'Position along hot-flow direction'}
            formatter={(value: number, name: string) => [
              `${Number(value).toFixed(2)} °C`,
              name === 'hot' ? 'Hot stream' : 'Cold stream',
            ]}
          />
          <Legend
            formatter={(value: string) => (value === 'hot' ? 'Hot stream' : 'Cold stream')}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="linear"
            dataKey="hot"
            name="hot"
            stroke={COLORS.hot}
            strokeWidth={2.5}
            dot={{ r: 4, fill: COLORS.hot }}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            dataKey="cold"
            name="cold"
            stroke={COLORS.cold}
            strokeWidth={2.5}
            strokeDasharray="7 4"
            dot={{ r: 4, fill: COLORS.cold }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="chart__caption">
        <p>
          <strong>Schematic only.</strong> The straight lines simply join the known endpoint
          temperatures; they are not a calculated internal temperature profile. The cold stream
          travels {isCounter ? 'opposite' : 'in the same direction as'} the hot stream, so{' '}
          {isCounter ? 'its endpoints are reversed' : 'its endpoints are aligned'} along the
          hot-flow axis.
        </p>
        <ul className="chart__legend-list">
          <li>
            <span className="swatch swatch--hot" aria-hidden="true" /> Hot:{' '}
            {inputs.hotInlet} °C → {inputs.hotOutlet} °C
          </li>
          <li>
            <span className="swatch swatch--cold" aria-hidden="true" /> Cold:{' '}
            {inputs.coldInlet} °C → {inputs.coldOutlet} °C
          </li>
        </ul>
      </div>
    </div>
  );
}
