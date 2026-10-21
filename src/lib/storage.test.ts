import { describe, it, expect, beforeEach } from 'vitest';
import { loadInputs, saveInputs, clearInputs, normaliseInputs } from './storage';
import { DEFAULT_EXAMPLE } from './heatExchanger';

describe('localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing has been saved', () => {
    expect(loadInputs()).toBeNull();
  });

  it('round-trips the inputs', () => {
    const inputs = { ...DEFAULT_EXAMPLE, U: 750, arrangement: 'parallel' as const };
    saveInputs(inputs);

    const loaded = loadInputs();
    expect(loaded).not.toBeNull();
    expect(loaded?.U).toBe(750);
    expect(loaded?.arrangement).toBe('parallel');
  });

  it('clears the stored inputs', () => {
    saveInputs({ ...DEFAULT_EXAMPLE });
    clearInputs();
    expect(loadInputs()).toBeNull();
  });

  it('normalises a corrupt stored payload into a usable input set', () => {
    localStorage.setItem(
      'thermolab.inputs.v1',
      JSON.stringify({ U: 'not a number', arrangement: 'nonsense' }),
    );
    const loaded = loadInputs();
    expect(loaded?.U).toBe(DEFAULT_EXAMPLE.U);
    expect(loaded?.arrangement).toBe('counter');
  });

  it('falls back to the defaults for a non-object payload', () => {
    expect(normaliseInputs(null)).toEqual(DEFAULT_EXAMPLE);
    expect(normaliseInputs('nope')).toEqual(DEFAULT_EXAMPLE);
  });
});
