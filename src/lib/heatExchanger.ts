/**
 * ThermoLab core calculation engine.
 *
 * All maths is pure and runs entirely in the browser. No network calls,
 * no persistence, no side effects beyond what the caller asks for.
 *
 * Model assumptions (see README for the full statement):
 *  - steady state
 *  - constant physical properties
 *  - negligible heat loss to surroundings
 *  - no phase change (sensible heat only)
 */

export type FlowArrangement = 'parallel' | 'counter';

export interface HeatExchangerInputs {
  /** Hot stream inlet temperature, degC */
  hotInlet: number;
  /** Hot stream outlet temperature, degC */
  hotOutlet: number;
  /** Cold stream inlet temperature, degC */
  coldInlet: number;
  /** Cold stream outlet temperature, degC */
  coldOutlet: number;
  /** Overall heat transfer coefficient, W/(m^2 K) */
  U: number;
  /** Hot stream mass flow rate, kg/s */
  hotMassFlow: number;
  /** Hot stream specific heat capacity, J/(kg K) */
  hotCp: number;
  /** Cold stream mass flow rate, kg/s (optional) */
  coldMassFlow?: number;
  /** Cold stream specific heat capacity, J/(kg K) (optional) */
  coldCp?: number;
  /** Correction factor, 0 < F <= 1 */
  correctionFactor: number;
  /** Parallel or counter flow */
  arrangement: FlowArrangement;
}

export interface FieldError {
  field: keyof HeatExchangerInputs;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

export interface LmtdResult {
  /** dT1, K */
  dT1: number;
  /** dT2, K */
  dT2: number;
  /** Log mean temperature difference, K */
  lmtd: number;
  /** True when the equal/near-equal limiting value was used instead of the ratio form. */
  usedLimitingValue: boolean;
}

export interface DutyResult {
  /** Duty from the hot stream, W */
  Q_hot: number;
  /** Duty from the cold stream, W (null when cold-side data was not supplied) */
  Q_cold: number | null;
  /** Percentage mismatch between the two duties (null when only one duty is known) */
  mismatchPercent: number | null;
  /** True when both duties are known and the mismatch is above the tolerance */
  energyBalanceOk: boolean;
  /** True when the duty is zero (no heat transfer) */
  zeroDuty: boolean;
  /** Tolerance used for the energy balance check */
  mismatchTolerancePercent: number;
}

export interface HeatExchangerResult {
  valid: boolean;
  errors: FieldError[];
  lmtd: LmtdResult | null;
  duty: DutyResult | null;
  /** Required heat transfer area, m^2 (null when the calculation is invalid) */
  area: number | null;
  /** Effective U F product, W/(m^2 K) */
  effectiveCoefficient: number;
}

/** Default example: counterflow water/air style case shipped with the app. */
export const DEFAULT_EXAMPLE: HeatExchangerInputs = {
  hotInlet: 150,
  hotOutlet: 90,
  coldInlet: 20,
  coldOutlet: 60,
  U: 500,
  hotMassFlow: 1,
  hotCp: 4180,
  coldMassFlow: undefined,
  coldCp: undefined,
  correctionFactor: 1,
  arrangement: 'counter',
};

/**
 * Terminal temperature differences for the given arrangement.
 *
 * counterflow: dT1 = Th_in - Tc_out , dT2 = Th_out - Tc_in
 * parallelflow: dT1 = Th_in - Tc_in , dT2 = Th_out - Tc_out
 */
export function terminalDifferences(
  inputs: Pick<
    HeatExchangerInputs,
    'arrangement' | 'hotInlet' | 'hotOutlet' | 'coldInlet' | 'coldOutlet'
  >,
): { dT1: number; dT2: number } {
  const { arrangement, hotInlet, hotOutlet, coldInlet, coldOutlet } = inputs;

  if (arrangement === 'counter') {
    return { dT1: hotInlet - coldOutlet, dT2: hotOutlet - coldInlet };
  }

  return { dT1: hotInlet - coldInlet, dT2: hotOutlet - coldOutlet };
}

/**
 * Log-mean temperature difference.
 *
 * The textbook form (dT1 - dT2) / ln(dT1 / dT2) is numerically unstable when
 * the two terminal differences are equal or nearly equal. In that regime the
 * continuous limiting value is used instead:
 *
 *   lim(dT1->dT2) (dT1 - dT2) / ln(dT1/dT2) = dT
 *
 * The switch happens on a relative tolerance so that "nearly equal" cases are
 * stable rather than wildly wrong. No division by zero is ever performed.
 */
export function lmtd(dT1: number, dT2: number): LmtdResult {
  const a = Math.abs(dT1);
  const b = Math.abs(dT2);

  // Guard against degenerate / non-finite input.
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0 || b === 0) {
    return { dT1, dT2, lmtd: NaN, usedLimitingValue: false };
  }

  const scale = Math.max(a, b);
  const relativeGap = Math.abs(a - b) / scale;

  // Relative tolerance: below this the two differences are "effectively equal"
  // and the direct ratio form loses precision. 1e-9 is tight enough to keep
  // genuinely different cases on the exact formula while removing the
  // 0/0 catastrophe.
  const EQUAL_TOLERANCE = 1e-9;

  if (relativeGap <= EQUAL_TOLERANCE) {
    // Stable limiting value for dT1 -> dT2 (and symmetric for dT2 -> dT1).
    return { dT1, dT2, lmtd: (a + b) / 2, usedLimitingValue: true };
  }

  const ratio = a / b;
  const logRatio = Math.log(ratio);
  const value = (a - b) / logRatio;

  return { dT1, dT2, lmtd: value, usedLimitingValue: false };
}

/** Hot-side heat duty, W. */
export function hotDuty(inputs: HeatExchangerInputs): number {
  return inputs.hotMassFlow * inputs.hotCp * (inputs.hotInlet - inputs.hotOutlet);
}

/** Cold-side heat duty, W (null when the cold-side data is incomplete). */
export function coldDuty(inputs: HeatExchangerInputs): number | null {
  const { coldMassFlow, coldCp } = inputs;
  if (coldMassFlow === undefined || coldCp === undefined) {
    return null;
  }
  if (!Number.isFinite(coldMassFlow) || !Number.isFinite(coldCp)) {
    return null;
  }
  return coldMassFlow * coldCp * (inputs.coldOutlet - inputs.coldInlet);
}

/**
 * Percentage mismatch between the two duties, using
 * max(|Q_hot|, |Q_cold|) as the denominator so the value never exceeds 100%.
 */
export function dutyMismatchPercent(Q_hot: number, Q_cold: number): number {
  const denominator = Math.max(Math.abs(Q_hot), Math.abs(Q_cold));
  if (denominator === 0) {
    return 0;
  }
  return (Math.abs(Q_hot - Q_cold) / denominator) * 100;
}

/** Tolerance used when judging whether the two duties agree. */
export const MISMATCH_TOLERANCE_PERCENT = 5;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function requireNumber(
  value: unknown,
  field: keyof HeatExchangerInputs,
  label: string,
  errors: FieldError[],
): number | null {
  if (!isFiniteNumber(value)) {
    errors.push({ field, message: `${label} must be a finite number.` });
    return null;
  }
  return value;
}

/**
 * Validate the input set.
 *
 * Rules enforced:
 *  - every required numeric input must be finite
 *  - U, flow rates and specific heats must be strictly positive
 *  - the hot stream must cool (Th_in >= Th_out) and the cold stream must heat
 *    (Tc_out >= Tc_in) — this is a sensible-heat exchanger. Equality is
 *    permitted so that the degenerate zero-duty case (no temperature change
 *    on either side) remains reachable and can be reported explicitly rather
 *    than being rejected as a validation error.
 *  - the correction factor must satisfy 0 < F <= 1
 *  - both terminal temperature differences must be strictly positive
 *
 * A counterflow exchanger whose cold outlet exceeds the hot outlet is legal
 * (it is the classic counterflow advantage) and is never rejected here.
 */
export function validateInputs(inputs: HeatExchangerInputs): ValidationResult {
  const errors: FieldError[] = [];

  const hotInlet = requireNumber(inputs.hotInlet, 'hotInlet', 'Hot inlet temperature', errors);
  const hotOutlet = requireNumber(inputs.hotOutlet, 'hotOutlet', 'Hot outlet temperature', errors);
  const coldInlet = requireNumber(inputs.coldInlet, 'coldInlet', 'Cold inlet temperature', errors);
  const coldOutlet = requireNumber(inputs.coldOutlet, 'coldOutlet', 'Cold outlet temperature', errors);
  const U = requireNumber(inputs.U, 'U', 'Overall heat transfer coefficient U', errors);
  const hotMassFlow = requireNumber(inputs.hotMassFlow, 'hotMassFlow', 'Hot stream mass flow rate', errors);
  const hotCp = requireNumber(inputs.hotCp, 'hotCp', 'Hot stream specific heat', errors);
  const F = requireNumber(inputs.correctionFactor, 'correctionFactor', 'Correction factor F', errors);

  if (U !== null && U <= 0) {
    errors.push({ field: 'U', message: 'U must be greater than 0 W/(m²·K).' });
  }
  if (hotMassFlow !== null && hotMassFlow <= 0) {
    errors.push({ field: 'hotMassFlow', message: 'Hot stream mass flow rate must be greater than 0 kg/s.' });
  }
  if (hotCp !== null && hotCp <= 0) {
    errors.push({ field: 'hotCp', message: 'Hot stream specific heat must be greater than 0 J/(kg·K).' });
  }
  if (F !== null && (F <= 0 || F > 1)) {
    errors.push({ field: 'correctionFactor', message: 'Correction factor F must satisfy 0 < F ≤ 1.' });
  }

  // Optional cold-side values: if one is supplied it must be valid, and a
  // partial pair is treated as "not supplied" rather than an error.
  const coldMassFlow = inputs.coldMassFlow;
  const coldCp = inputs.coldCp;
  const coldMassFlowSupplied = coldMassFlow !== undefined && coldMassFlow !== null;
  const coldCpSupplied = coldCp !== undefined && coldCp !== null;

  if (coldMassFlowSupplied && !isFiniteNumber(coldMassFlow)) {
    errors.push({ field: 'coldMassFlow', message: 'Cold stream mass flow rate must be a finite number.' });
  } else if (coldMassFlowSupplied && coldMassFlow <= 0) {
    errors.push({ field: 'coldMassFlow', message: 'Cold stream mass flow rate must be greater than 0 kg/s.' });
  }
  if (coldCpSupplied && !isFiniteNumber(coldCp)) {
    errors.push({ field: 'coldCp', message: 'Cold stream specific heat must be a finite number.' });
  } else if (coldCpSupplied && coldCp <= 0) {
    errors.push({ field: 'coldCp', message: 'Cold stream specific heat must be greater than 0 J/(kg·K).' });
  }

  if (
    hotInlet !== null &&
    hotOutlet !== null &&
    !(hotInlet >= hotOutlet)
  ) {
    errors.push({
      field: 'hotOutlet',
      message:
        'The hot stream must cool: the hot inlet temperature must not be below the hot outlet temperature.',
    });
  }

  if (
    coldInlet !== null &&
    coldOutlet !== null &&
    !(coldOutlet >= coldInlet)
  ) {
    errors.push({
      field: 'coldOutlet',
      message:
        'The cold stream must heat: the cold outlet temperature must not be below the cold inlet temperature.',
    });
  }

  // Terminal temperature differences must be positive.
  if (
    hotInlet !== null &&
    hotOutlet !== null &&
    coldInlet !== null &&
    coldOutlet !== null
  ) {
    const { dT1, dT2 } = terminalDifferences(inputs);
    if (dT1 <= 0) {
      errors.push({
        field: 'arrangement',
        message: `Terminal difference dT1 = ${round(dT1, 4)} K must be greater than 0 for ${
          inputs.arrangement === 'counter' ? 'counter' : 'parallel'
        } flow.`,
      });
    }
    if (dT2 <= 0) {
      errors.push({
        field: 'arrangement',
        message: `Terminal difference dT2 = ${round(dT2, 4)} K must be greater than 0 for ${
          inputs.arrangement === 'counter' ? 'counter' : 'parallel'
        } flow.`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Full calculation: validate, then compute LMTD, duties and required area.
 * When the inputs are invalid the result carries the errors and no numbers.
 */
export function calculate(inputs: HeatExchangerInputs): HeatExchangerResult {
  const validation = validateInputs(inputs);

  if (!validation.valid) {
    return {
      valid: false,
      errors: validation.errors,
      lmtd: null,
      duty: null,
      area: null,
      effectiveCoefficient: inputs.U * inputs.correctionFactor,
    };
  }

  const { dT1, dT2 } = terminalDifferences(inputs);
  const lmtdResult = lmtd(dT1, dT2);

  const Q_hot = hotDuty(inputs);
  const Q_cold = coldDuty(inputs);
  const mismatchPercent = Q_cold === null ? null : dutyMismatchPercent(Q_hot, Q_cold);
  const energyBalanceOk =
    mismatchPercent === null ? true : mismatchPercent <= MISMATCH_TOLERANCE_PERCENT;

  const zeroDuty = Q_hot === 0;

  const duty: DutyResult = {
    Q_hot,
    Q_cold,
    mismatchPercent,
    energyBalanceOk,
    zeroDuty,
    mismatchTolerancePercent: MISMATCH_TOLERANCE_PERCENT,
  };

  const effectiveCoefficient = inputs.U * inputs.correctionFactor;

  let area: number | null = null;
  if (Number.isFinite(lmtdResult.lmtd) && lmtdResult.lmtd > 0 && effectiveCoefficient > 0) {
    area = Q_hot / (effectiveCoefficient * lmtdResult.lmtd);
  }

  return {
    valid: true,
    errors: [],
    lmtd: lmtdResult,
    duty,
    area,
    effectiveCoefficient,
  };
}

/**
 * Required area for a hypothetical U value, holding everything else fixed.
 * Used by the "area vs U" chart. Returns null when the value is not meaningful.
 */
export function areaForU(inputs: HeatExchangerInputs, U: number): number | null {
  if (!Number.isFinite(U) || U <= 0) {
    return null;
  }
  const result = calculate({ ...inputs, U });
  if (!result.valid || result.area === null) {
    return null;
  }
  return result.area;
}

/**
 * Required area for a hypothetical correction factor F, holding everything
 * else fixed. Only 0 < F <= 1 is meaningful.
 */
export function areaForF(inputs: HeatExchangerInputs, F: number): number | null {
  if (!Number.isFinite(F) || F <= 0 || F > 1) {
    return null;
  }
  const result = calculate({ ...inputs, correctionFactor: F });
  if (!result.valid || result.area === null) {
    return null;
  }
  return result.area;
}

/**
 * Endpoint data for the hot/cold temperature diagram.
 *
 * The horizontal axis is the position along the hot-flow direction, running
 * from 0 (hot inlet) to 1 (hot outlet).
 *
 * For parallel flow both streams travel in the same direction, so the cold
 * endpoints sit at 0 and 1. For counter flow the cold stream travels in the
 * opposite direction, so the cold inlet sits at x = 1 and the cold outlet at
 * x = 0 (the cold endpoints are reversed).
 *
 * The connecting segments are schematic straight lines: they are NOT a
 * calculated internal temperature profile.
 */
export interface TemperaturePoint {
  position: number;
  temperature: number;
  label: string;
}

export interface TemperatureDiagramData {
  hot: TemperaturePoint[];
  cold: TemperaturePoint[];
  /** Axis label, always "Position along hot-flow direction". */
  xAxisLabel: string;
}

export function temperatureDiagram(
  inputs: HeatExchangerInputs,
): TemperatureDiagramData {
  const hot: TemperaturePoint[] = [
    { position: 0, temperature: inputs.hotInlet, label: 'Hot inlet' },
    { position: 1, temperature: inputs.hotOutlet, label: 'Hot outlet' },
  ];

  const cold: TemperaturePoint[] =
    inputs.arrangement === 'counter'
      ? [
          { position: 0, temperature: inputs.coldOutlet, label: 'Cold outlet' },
          { position: 1, temperature: inputs.coldInlet, label: 'Cold inlet' },
        ]
      : [
          { position: 0, temperature: inputs.coldInlet, label: 'Cold inlet' },
          { position: 1, temperature: inputs.coldOutlet, label: 'Cold outlet' },
        ];

  return { hot, cold, xAxisLabel: 'Position along hot-flow direction' };
}
