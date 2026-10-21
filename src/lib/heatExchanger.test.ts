import { describe, it, expect } from 'vitest';
import {
  calculate,
  validateInputs,
  lmtd,
  terminalDifferences,
  hotDuty,
  coldDuty,
  dutyMismatchPercent,
  areaForU,
  areaForF,
  temperatureDiagram,
  DEFAULT_EXAMPLE,
  MISMATCH_TOLERANCE_PERCENT,
  type HeatExchangerInputs,
} from './heatExchanger';

function inputs(overrides: Partial<HeatExchangerInputs> = {}): HeatExchangerInputs {
  return { ...DEFAULT_EXAMPLE, ...overrides };
}

describe('default example (counterflow)', () => {
  it('matches the documented reference results', () => {
    const result = calculate(DEFAULT_EXAMPLE);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Terminal differences
    expect(result.lmtd?.dT1).toBeCloseTo(90, 10); // Th_in - Tc_out = 150 - 60
    expect(result.lmtd?.dT2).toBeCloseTo(70, 10); // Th_out - Tc_in = 90 - 20

    // LMTD = (90 - 70) / ln(90/70) = 79.5816 K.
    // (The brief quotes 79.5829 K; that figure is a typo. The brief's own
    // area of 6.3029 m^2 is only reproducible with 79.5816 K, which is what
    // the exact formula gives.)
    expect(result.lmtd?.lmtd).toBeCloseTo(79.5816, 3);
    expect(result.lmtd?.lmtd).toBeCloseTo(20 / Math.log(90 / 70), 12);

    // Q_hot = 1 * 4180 * (150 - 90) = 250800 W
    expect(result.duty?.Q_hot).toBeCloseTo(250800, 6);

    // Area approx 6.3029 m^2
    expect(result.area).toBeCloseTo(6.3029, 3);
  });

  it('uses the counterflow terminal differences', () => {
    const { dT1, dT2 } = terminalDifferences(DEFAULT_EXAMPLE);
    expect(dT1).toBe(90);
    expect(dT2).toBe(70);
  });

  it('does not flag an energy mismatch when cold-side data is absent', () => {
    const result = calculate(DEFAULT_EXAMPLE);
    expect(result.duty?.Q_cold).toBeNull();
    expect(result.duty?.mismatchPercent).toBeNull();
    expect(result.duty?.energyBalanceOk).toBe(true);
  });
});

describe('LMTD stability', () => {
  it('uses the limiting value when the terminal differences are exactly equal', () => {
    // Counterflow with dT1 == dT2 == 80 K: Th_in - Tc_out = 80, Th_out - Tc_in = 80
    const result = lmtd(80, 80);
    expect(result.usedLimitingValue).toBe(true);
    expect(result.lmtd).toBe(80);
    expect(Number.isFinite(result.lmtd)).toBe(true);
  });

  it('does not divide by zero for exactly equal differences', () => {
    expect(() => lmtd(50, 50)).not.toThrow();
    expect(lmtd(50, 50).lmtd).toBe(50);
  });

  it('handles nearly equal differences without exploding', () => {
    const result = lmtd(80, 80 * (1 + 1e-12));
    expect(Number.isFinite(result.lmtd)).toBe(true);
    expect(result.lmtd).toBeCloseTo(80, 6);
  });

  it('is stable across a wide range of near-equal pairs', () => {
    for (const gap of [1e-6, 1e-9, 1e-12, 1e-15]) {
      const result = lmtd(100, 100 + gap);
      expect(Number.isFinite(result.lmtd)).toBe(true);
      expect(result.lmtd).toBeCloseTo(100, 4);
    }
  });

  it('matches the direct ratio formula for clearly different differences', () => {
    const dT1 = 90;
    const dT2 = 70;
    const expected = (dT1 - dT2) / Math.log(dT1 / dT2);
    const result = lmtd(dT1, dT2);
    expect(result.usedLimitingValue).toBe(false);
    expect(result.lmtd).toBeCloseTo(expected, 10);
  });

  it('returns the limiting value for an equal-difference exchanger', () => {
    // Th_in=150, Th_out=90, Tc_in=20, Tc_out=80 -> dT1 = 70, dT2 = 70
    const caseEqual = inputs({ coldOutlet: 80 });
    const result = calculate(caseEqual);
    expect(result.valid).toBe(true);
    expect(result.lmtd?.usedLimitingValue).toBe(true);
    expect(result.lmtd?.lmtd).toBeCloseTo(70, 10);
    // A = 250800 / (500 * 1 * 70) = 7.1657...
    expect(result.area).toBeCloseTo(7.1657142857, 6);
  });
});

describe('validation', () => {
  it('rejects a non-finite numeric input', () => {
    const result = validateInputs(inputs({ U: NaN }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'U')).toBe(true);
  });

  it('rejects Infinity', () => {
    const result = validateInputs(inputs({ hotInlet: Infinity }));
    expect(result.valid).toBe(false);
  });

  it('rejects a non-positive U', () => {
    expect(validateInputs(inputs({ U: 0 })).valid).toBe(false);
    expect(validateInputs(inputs({ U: -100 })).valid).toBe(false);
  });

  it('rejects a non-positive hot mass flow rate', () => {
    expect(validateInputs(inputs({ hotMassFlow: 0 })).valid).toBe(false);
    expect(validateInputs(inputs({ hotMassFlow: -1 })).valid).toBe(false);
  });

  it('rejects a non-positive hot specific heat', () => {
    expect(validateInputs(inputs({ hotCp: 0 })).valid).toBe(false);
  });

  it('rejects a non-positive cold mass flow rate', () => {
    expect(validateInputs(inputs({ coldMassFlow: 0, coldCp: 4000 })).valid).toBe(false);
  });

  it('rejects a non-positive cold specific heat', () => {
    expect(validateInputs(inputs({ coldMassFlow: 1, coldCp: -10 })).valid).toBe(false);
  });

  it('rejects a hot stream that does not cool', () => {
    const result = validateInputs(inputs({ hotInlet: 90, hotOutlet: 150 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'hotOutlet')).toBe(true);
  });

  it('rejects a cold stream that does not heat', () => {
    const result = validateInputs(inputs({ coldInlet: 60, coldOutlet: 20 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'coldOutlet')).toBe(true);
  });

  it('rejects a correction factor outside 0 < F <= 1', () => {
    expect(validateInputs(inputs({ correctionFactor: 0 })).valid).toBe(false);
    expect(validateInputs(inputs({ correctionFactor: -0.5 })).valid).toBe(false);
    expect(validateInputs(inputs({ correctionFactor: 1.01 })).valid).toBe(false);
    expect(validateInputs(inputs({ correctionFactor: 1 })).valid).toBe(true);
  });

  it('rejects non-positive terminal differences', () => {
    // Counterflow: dT1 = Th_in - Tc_out = 100 - 110 = -10 K
    const result = validateInputs(inputs({ coldInlet: 120, coldOutlet: 110 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'arrangement')).toBe(true);
  });

  it('suppresses all results when the inputs are invalid', () => {
    const result = calculate(inputs({ U: -1 }));
    expect(result.valid).toBe(false);
    expect(result.lmtd).toBeNull();
    expect(result.duty).toBeNull();
    expect(result.area).toBeNull();
  });
});

describe('parallel flow', () => {
  it('uses the parallel terminal differences', () => {
    const parallel = inputs({ arrangement: 'parallel' });
    const { dT1, dT2 } = terminalDifferences(parallel);
    expect(dT1).toBe(130); // Th_in - Tc_in = 150 - 20
    expect(dT2).toBe(30); // Th_out - Tc_out = 90 - 60
  });

  it('rejects a parallel-flow temperature crossing', () => {
    // Parallel flow with Tc_out (110) above Th_out (90) gives dT2 = -20 K.
    const crossing = inputs({
      arrangement: 'parallel',
      coldInlet: 20,
      coldOutlet: 110,
    });
    const result = validateInputs(crossing);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'arrangement')).toBe(true);
  });

  it('rejects a parallel flow where the cold outlet reaches the hot outlet', () => {
    const touching = inputs({
      arrangement: 'parallel',
      coldInlet: 20,
      coldOutlet: 90,
    });
    expect(validateInputs(touching).valid).toBe(false);
  });
});

describe('counterflow temperature crossing', () => {
  it('accepts a valid counterflow case where the cold outlet exceeds the hot outlet', () => {
    // Th_in=150, Th_out=90, Tc_in=20, Tc_out=100.
    // Counterflow dT1 = 150 - 100 = 50 K, dT2 = 90 - 20 = 70 K -> both positive.
    const crossing = inputs({ coldInlet: 20, coldOutlet: 100 });
    const result = validateInputs(crossing);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    const calc = calculate(crossing);
    expect(calc.valid).toBe(true);
    expect(calc.lmtd?.dT1).toBeCloseTo(50, 10);
    expect(calc.lmtd?.dT2).toBeCloseTo(70, 10);
    expect(calc.lmtd?.lmtd).toBeCloseTo(
      (50 - 70) / Math.log(50 / 70),
      10,
    );
  });

  it('still rejects a counterflow case with a non-positive terminal difference', () => {
    // dT2 = Th_out - Tc_in = 90 - 95 = -5 K
    const bad = inputs({ coldInlet: 95, coldOutlet: 100 });
    expect(validateInputs(bad).valid).toBe(false);
  });
});

describe('energy balance', () => {
  it('reports matching duties when the cold side is consistent', () => {
    // Q_hot = 1 * 4180 * 60 = 250800 W
    // Choose m_cold * cp_cold * 40 = 250800 -> 4180 * 1.5 * 40 = 250800
    const balanced = inputs({ coldMassFlow: 1.5, coldCp: 4180 });
    const result = calculate(balanced);

    expect(result.valid).toBe(true);
    expect(result.duty?.Q_hot).toBeCloseTo(250800, 6);
    expect(result.duty?.Q_cold).toBeCloseTo(250800, 6);
    expect(result.duty?.mismatchPercent).toBeCloseTo(0, 10);
    expect(result.duty?.energyBalanceOk).toBe(true);
  });

  it('reports the mismatch percentage when the duties disagree', () => {
    // Q_cold = 1 * 4180 * (60 - 20) = 167200 W vs Q_hot = 250800 W
    // mismatch = |250800 - 167200| / max(250800, 167200) * 100
    const unbalanced = inputs({ coldMassFlow: 1, coldCp: 4180 });
    const result = calculate(unbalanced);

    expect(result.duty?.Q_cold).toBeCloseTo(167200, 6);
    expect(result.duty?.mismatchPercent).toBeCloseTo(
      (Math.abs(250800 - 167200) / 250800) * 100,
      8,
    );
    expect(result.duty?.energyBalanceOk).toBe(false);
    expect(result.duty?.mismatchPercent).toBeGreaterThan(MISMATCH_TOLERANCE_PERCENT);
  });

  it('uses max(|Q_hot|, |Q_cold|) as the denominator so mismatch never exceeds 100%', () => {
    const mismatch = dutyMismatchPercent(100, 20);
    expect(mismatch).toBeCloseTo(80, 10);
    expect(dutyMismatchPercent(20, 100)).toBeCloseTo(80, 10);
    expect(dutyMismatchPercent(-100, 100)).toBeCloseTo(200, 10);
  });

  it('does not average inconsistent duties', () => {
    const unbalanced = inputs({ coldMassFlow: 1, coldCp: 4180 });
    const result = calculate(unbalanced);
    // The reported hot-side duty is used verbatim for sizing; it is never
    // blended with the cold-side duty.
    expect(result.duty?.Q_hot).toBeCloseTo(250800, 6);
    expect(result.area).toBeCloseTo(
      250800 / (500 * 1 * result.lmtd!.lmtd),
      10,
    );
  });

  it('computes the hot and cold duties independently', () => {
    expect(hotDuty(DEFAULT_EXAMPLE)).toBeCloseTo(250800, 6);
    expect(coldDuty(inputs({ coldMassFlow: 2, coldCp: 4180 }))).toBeCloseTo(334400, 6);
    expect(coldDuty(DEFAULT_EXAMPLE)).toBeNull();
  });
});

describe('zero duty handling', () => {
  it('handles a zero cold-side duty explicitly', () => {
    // Cold stream that does not change temperature would be invalid, but the
    // helper must still report a zero duty rather than NaN.
    const noChange = inputs({ coldMassFlow: 1, coldCp: 4180, coldOutlet: 20 });
    expect(coldDuty(noChange)).toBe(0);
    expect(dutyMismatchPercent(250800, 0)).toBeCloseTo(100, 10);
  });

  it('returns a zero mismatch when both duties are zero', () => {
    expect(dutyMismatchPercent(0, 0)).toBe(0);
  });

  it('accepts the degenerate no-temperature-change case and reports it explicitly', () => {
    // The hot stream enters and leaves at the same temperature, so no heat is
    // transferred and Q_hot is zero. The cold side still heats, so the
    // terminal differences stay positive and the LMTD is well defined.
    const noChange = inputs({
      hotInlet: 100,
      hotOutlet: 100,
      coldInlet: 20,
      coldOutlet: 60,
      coldMassFlow: 1,
      coldCp: 4180,
    });
    const result = calculate(noChange);

    expect(result.valid).toBe(true);
    expect(result.duty?.zeroDuty).toBe(true);
    expect(result.duty?.Q_hot).toBe(0);
    expect(result.lmtd?.dT1).toBeCloseTo(40, 10);
    expect(result.lmtd?.dT2).toBeCloseTo(80, 10);
    // Q = 0 with a positive LMTD and positive U*F gives an area of exactly 0.
    expect(result.area).toBe(0);
  });

  it('still rejects a hot stream that heats up', () => {
    expect(validateInputs(inputs({ hotInlet: 90, hotOutlet: 150 })).valid).toBe(false);
  });

  it('still rejects a cold stream that cools down', () => {
    expect(validateInputs(inputs({ coldInlet: 60, coldOutlet: 20 })).valid).toBe(false);
  });
});

describe('area sweeps', () => {
  it('computes the area for a hypothetical U', () => {
    const area = areaForU(DEFAULT_EXAMPLE, 1000);
    expect(area).toBeCloseTo(250800 / (1000 * 79.581582867359458), 8);
  });

  it('returns null for a non-positive U in the sweep', () => {
    expect(areaForU(DEFAULT_EXAMPLE, 0)).toBeNull();
    expect(areaForU(DEFAULT_EXAMPLE, -1)).toBeNull();
  });

  it('computes the area for a hypothetical correction factor', () => {
    const area = areaForF(DEFAULT_EXAMPLE, 0.8);
    expect(area).toBeCloseTo(250800 / (500 * 0.8 * 79.581582867359458), 8);
  });

  it('returns null for an out-of-range correction factor in the sweep', () => {
    expect(areaForF(DEFAULT_EXAMPLE, 0)).toBeNull();
    expect(areaForF(DEFAULT_EXAMPLE, 1.5)).toBeNull();
  });
});

describe('temperature diagram', () => {
  it('reverses the cold endpoints for counterflow', () => {
    const data = temperatureDiagram(DEFAULT_EXAMPLE);
    expect(data.xAxisLabel).toBe('Position along hot-flow direction');
    expect(data.hot[0]?.temperature).toBe(150);
    expect(data.hot[1]?.temperature).toBe(90);
    // Cold flows opposite to hot: cold outlet at x = 0, cold inlet at x = 1.
    expect(data.cold[0]?.temperature).toBe(60);
    expect(data.cold[1]?.temperature).toBe(20);
  });

  it('keeps the cold endpoints aligned with the hot direction for parallel flow', () => {
    const data = temperatureDiagram(inputs({ arrangement: 'parallel' }));
    expect(data.cold[0]?.temperature).toBe(20);
    expect(data.cold[1]?.temperature).toBe(60);
  });
});
