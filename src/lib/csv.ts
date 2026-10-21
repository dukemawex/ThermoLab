import type { HeatExchangerInputs, HeatExchangerResult } from './heatExchanger';

function escapeCsv(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function row(cells: (string | number | boolean | null)[]): string {
  return cells.map(escapeCsv).join(',');
}

/**
 * Build a CSV report of the current inputs and results.
 * Section 1 is the input set, section 2 the computed results.
 */
export function buildCsv(
  inputs: HeatExchangerInputs,
  result: HeatExchangerResult,
): string {
  const lines: string[] = [];

  lines.push('ThermoLab - Heat Exchanger Calculation');
  lines.push('');
  lines.push('INPUTS');
  lines.push(row(['Parameter', 'Value', 'Unit']));
  lines.push(row(['Flow arrangement', inputs.arrangement === 'counter' ? 'Counterflow' : 'Parallel flow', '']));
  lines.push(row(['Hot inlet temperature', inputs.hotInlet, 'degC']));
  lines.push(row(['Hot outlet temperature', inputs.hotOutlet, 'degC']));
  lines.push(row(['Cold inlet temperature', inputs.coldInlet, 'degC']));
  lines.push(row(['Cold outlet temperature', inputs.coldOutlet, 'degC']));
  lines.push(row(['Overall heat transfer coefficient U', inputs.U, 'W/(m2.K)']));
  lines.push(row(['Hot stream mass flow rate', inputs.hotMassFlow, 'kg/s']));
  lines.push(row(['Hot stream specific heat', inputs.hotCp, 'J/(kg.K)']));
  lines.push(row(['Cold stream mass flow rate', inputs.coldMassFlow ?? '', 'kg/s']));
  lines.push(row(['Cold stream specific heat', inputs.coldCp ?? '', 'J/(kg.K)']));
  lines.push(row(['Correction factor F', inputs.correctionFactor, '-']));
  lines.push('');

  lines.push('RESULTS');
  lines.push(row(['Quantity', 'Value', 'Unit']));
  if (!result.valid || !result.lmtd || !result.duty) {
    lines.push(row(['Status', 'Invalid inputs - no results', '']));
    lines.push('');
    lines.push('VALIDATION ERRORS');
    lines.push(row(['Field', 'Message']));
    for (const error of result.errors) {
      lines.push(row([error.field, error.message]));
    }
  } else {
    lines.push(row(['Hot-side duty Q_hot', result.duty.Q_hot, 'W']));
    lines.push(row(['Cold-side duty Q_cold', result.duty.Q_cold ?? '', 'W']));
    lines.push(row(
      [
        'Duty mismatch',
        result.duty.mismatchPercent === null ? '' : result.duty.mismatchPercent,
        '%',
      ],
    ));
    lines.push(row(['Terminal difference dT1', result.lmtd.dT1, 'K']));
    lines.push(row(['Terminal difference dT2', result.lmtd.dT2, 'K']));
    lines.push(row(['LMTD', result.lmtd.lmtd, 'K']));
    lines.push(row(['LMTD limiting value used', result.lmtd.usedLimitingValue ? 'yes' : 'no', '']));
    lines.push(row(['Effective coefficient U x F', result.effectiveCoefficient, 'W/(m2.K)']));
    lines.push(row(['Required area A', result.area ?? '', 'm2']));
    lines.push(row(['Energy balance within tolerance', result.duty.energyBalanceOk ? 'yes' : 'no', '']));
  }

  lines.push('');
  lines.push('ASSUMPTIONS');
  lines.push(row(['Steady state', 'yes', '']));
  lines.push(row(['Constant physical properties', 'yes', '']));
  lines.push(row(['Negligible heat loss to surroundings', 'yes', '']));
  lines.push(row(['No phase change (sensible heat only)', 'yes', '']));
  lines.push(row(['Area sizing basis', 'Hot-stream duty Q_hot', '']));
  lines.push(row(['Correction factor F', 'User supplied (0 < F <= 1)', '']));

  return lines.join('\r\n');
}

/** Trigger a browser download of the CSV report. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
