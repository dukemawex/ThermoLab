import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from './App';

function setField(testId: string, value: string) {
  const input = screen.getByTestId(testId);
  fireEvent.change(input, { target: { value } });
}

describe('ThermoLab app', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the default example with the documented results', () => {
    render(<App />);

    const area = screen.getByTestId('stat-area');
    expect(area).toHaveTextContent('6.30297');

    const qHot = screen.getByTestId('stat-qhot');
    expect(qHot).toHaveTextContent('250,800');

    const lmtd = screen.getByTestId('stat-lmtd');
    expect(lmtd).toHaveTextContent('79.58158');
  });

  it('shows the worked calculation with substituted values', () => {
    render(<App />);
    const worked = screen.getByTestId('worked');
    expect(worked).toHaveTextContent('250800');
    expect(worked).toHaveTextContent('150');
    expect(worked).toHaveTextContent('6.30297');
  });

  it('suppresses results and shows inline errors for invalid input', () => {
    render(<App />);

    setField('u-value', '-10');

    expect(screen.getByTestId('results-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('results')).not.toBeInTheDocument();
    expect(screen.getByTestId('error-summary')).toHaveTextContent('input problem');
    // The message appears both inline under the field and in the suppressed
    // results panel, so more than one node may carry it.
    expect(
      screen.getAllByText('U must be greater than 0 W/(m²·K).').length,
    ).toBeGreaterThan(0);
  });

  it('rejects a hot stream that does not cool', () => {
    render(<App />);
    setField('hot-outlet', '200');

    expect(screen.getByTestId('results-empty')).toBeInTheDocument();
    expect(
      screen.getAllByText(/hot stream must cool/i).length,
    ).toBeGreaterThan(0);
  });

  it('rejects a correction factor above 1', () => {
    render(<App />);
    setField('correction-factor', '1.5');

    expect(screen.getByTestId('results-empty')).toBeInTheDocument();
    expect(
      screen.getAllByText('Correction factor F must satisfy 0 < F ≤ 1.').length,
    ).toBeGreaterThan(0);
  });

  it('rejects a parallel-flow temperature crossing but accepts the counterflow case', () => {
    render(<App />);

    // Parallel flow with a cold outlet above the hot outlet is invalid.
    fireEvent.click(screen.getByTestId('arrangement-parallel'));
    setField('cold-outlet', '110');
    expect(screen.getByTestId('results-empty')).toBeInTheDocument();

    // The same numbers are perfectly valid in counter flow.
    fireEvent.click(screen.getByTestId('arrangement-counter'));
    expect(screen.queryByTestId('results-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('results')).toBeInTheDocument();
  });

  it('reports the cold-side energy balance mismatch', () => {
    render(<App />);

    setField('cold-mass-flow', '1');
    setField('cold-cp', '4180');

    const balance = screen.getByTestId('balance');
    expect(balance).toHaveTextContent('mismatch');
    expect(within(balance).getByTestId('mismatch')).toHaveTextContent('%');

    // Q_cold = 167200 W against Q_hot = 250800 W -> 33.33% mismatch.
    expect(screen.getByTestId('stat-qcold')).toHaveTextContent('167,200');
    expect(screen.getByTestId('mismatch')).toHaveTextContent('33.33');
  });

  it('reports a zero-duty case explicitly rather than hiding it', () => {
    render(<App />);

    // The hot stream enters and leaves at the same temperature: no heat is
    // transferred, but the case stays valid and is flagged.
    setField('hot-inlet', '100');
    setField('hot-outlet', '100');

    expect(screen.getByTestId('results')).toBeInTheDocument();
    expect(screen.getByTestId('zero-duty')).toHaveTextContent('Zero-duty case');
    expect(screen.getByTestId('stat-area')).toHaveTextContent('0.00000');
  });

  it('lets the user clear a required field and reports it as invalid', () => {
    render(<App />);

    const input = screen.getByTestId('hot-inlet') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });

    // An emptied required field must be reported, not silently ignored.
    expect(input.value).toBe('');
    expect(screen.getByTestId('results-empty')).toBeInTheDocument();
    expect(
      screen.getAllByText(/must be a finite number/i).length,
    ).toBeGreaterThan(0);
  });

  it('lets the user clear an optional cold-side field without an error', () => {
    render(<App />);

    setField('cold-mass-flow', '1');
    setField('cold-cp', '4180');
    expect(screen.getByTestId('stat-qcold')).toHaveTextContent('167,200');

    const input = screen.getByTestId('cold-mass-flow') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
    // The cold side is now simply not supplied: no error, and the duty
    // falls back to "not available".
    expect(screen.queryByTestId('results-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('stat-qcold')).toHaveTextContent('—');
  });

  it('keeps the field editable when typing a negative value', () => {
    render(<App />);

    const input = screen.getByTestId('u-value') as HTMLInputElement;
    // A number input reports an empty string for a partial "-" entry.
    fireEvent.change(input, { target: { value: '-5' } });

    expect(input.value).toBe('-5');
    expect(screen.getByTestId('results-empty')).toBeInTheDocument();
    expect(
      screen.getAllByText('U must be greater than 0 W/(m²·K).').length,
    ).toBeGreaterThan(0);
  });

  it('restores the default example with the load-example button', () => {
    render(<App />);
    setField('hot-inlet', '300');
    expect(screen.getByTestId('stat-area')).not.toHaveTextContent('6.30297');

    fireEvent.click(screen.getByTestId('load-example'));
    expect(screen.getByTestId('stat-area')).toHaveTextContent('6.30297');
  });

  it('resets to the default example with the reset button', () => {
    render(<App />);
    setField('u-value', '999');
    fireEvent.click(screen.getByTestId('reset'));
    expect(screen.getByTestId('stat-area')).toHaveTextContent('6.30297');
  });

  it('saves the inputs to localStorage', () => {
    render(<App />);
    setField('u-value', '750');

    const stored = localStorage.getItem('thermolab.inputs.v1');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed.U).toBe(750);
  });

  it('restores the saved inputs on a fresh mount', () => {
    localStorage.setItem(
      'thermolab.inputs.v1',
      JSON.stringify({
        hotInlet: 150,
        hotOutlet: 90,
        coldInlet: 20,
        coldOutlet: 60,
        U: 250,
        hotMassFlow: 1,
        hotCp: 4180,
        correctionFactor: 1,
        arrangement: 'counter',
      }),
    );

    render(<App />);
    // Halving U doubles the required area: 6.3029 -> 12.6059
    expect(screen.getByTestId('stat-area')).toHaveTextContent('12.60593');
  });

  it('exports the results as CSV', () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<App />);
    fireEvent.click(screen.getByTestId('export-csv'));

    expect(clickSpy).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('prints the results', () => {
    const printSpy = vi.fn();
    Object.assign(window, { print: printSpy });

    render(<App />);
    fireEvent.click(screen.getByTestId('print'));

    expect(printSpy).toHaveBeenCalled();
  });
});
