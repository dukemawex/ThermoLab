import { describe, it, expect } from 'vitest';
import { buildCsv } from './csv';
import { calculate, DEFAULT_EXAMPLE, type HeatExchangerInputs } from './heatExchanger';

const withCold: HeatExchangerInputs = {
  ...DEFAULT_EXAMPLE,
  coldMassFlow: 1,
  coldCp: 4180,
};

describe('CSV export', () => {
  it('contains the inputs and the computed results', () => {
    const csv = buildCsv(DEFAULT_EXAMPLE, calculate(DEFAULT_EXAMPLE));

    expect(csv).toContain('Hot inlet temperature,150,degC');
    expect(csv).toContain('Overall heat transfer coefficient U,500,W/(m2.K)');
    expect(csv).toContain('Counterflow');
    expect(csv).toContain('Hot-side duty Q_hot,250800,W');
    expect(csv).toContain('LMTD,');
    expect(csv).toContain('Required area A,');
    expect(csv).toContain('Area sizing basis,Hot-stream duty Q_hot');
  });

  it('reports both duties and the mismatch when the cold side is supplied', () => {
    const csv = buildCsv(withCold, calculate(withCold));
    expect(csv).toContain('Cold-side duty Q_cold,167200,W');
    expect(csv).toContain('Duty mismatch,33.33333333');
    expect(csv).toContain('Energy balance within tolerance,no');
  });

  it('lists the validation errors when the inputs are invalid', () => {
    const invalid = { ...DEFAULT_EXAMPLE, U: -5 };
    const csv = buildCsv(invalid, calculate(invalid));
    expect(csv).toContain('Invalid inputs - no results');
    expect(csv).toContain('U must be greater than 0');
  });

  it('escapes commas and quotes in values', () => {
    const csv = buildCsv(DEFAULT_EXAMPLE, calculate(DEFAULT_EXAMPLE));
    // The header labels contain no commas, so every record should be a clean
    // three-column row.
    const dataRows = csv
      .split(/\r?\n/)
      .filter((line) => line.startsWith('Hot inlet temperature'));
    expect(dataRows).toHaveLength(1);
    expect(dataRows[0]?.split(',')).toHaveLength(3);
  });
});
