import { DEFAULT_EXAMPLE, type HeatExchangerInputs, type FlowArrangement } from './heatExchanger';

const STORAGE_KEY = 'thermolab.inputs.v1';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function num(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function optionalNum(value: unknown): number | undefined {
  return isFiniteNumber(value) ? value : undefined;
}

/** Coerce an arbitrary parsed object into a valid input set. */
export function normaliseInputs(raw: unknown): HeatExchangerInputs {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_EXAMPLE };
  }
  const r = raw as Record<string, unknown>;
  const arrangement: FlowArrangement = r.arrangement === 'parallel' ? 'parallel' : 'counter';

  return {
    hotInlet: num(r.hotInlet, DEFAULT_EXAMPLE.hotInlet),
    hotOutlet: num(r.hotOutlet, DEFAULT_EXAMPLE.hotOutlet),
    coldInlet: num(r.coldInlet, DEFAULT_EXAMPLE.coldInlet),
    coldOutlet: num(r.coldOutlet, DEFAULT_EXAMPLE.coldOutlet),
    U: num(r.U, DEFAULT_EXAMPLE.U),
    hotMassFlow: num(r.hotMassFlow, DEFAULT_EXAMPLE.hotMassFlow),
    hotCp: num(r.hotCp, DEFAULT_EXAMPLE.hotCp),
    coldMassFlow: optionalNum(r.coldMassFlow),
    coldCp: optionalNum(r.coldCp),
    correctionFactor: num(r.correctionFactor, DEFAULT_EXAMPLE.correctionFactor),
    arrangement,
  };
}

/** Persist the current inputs. Silently ignores storage failures. */
export function saveInputs(inputs: HeatExchangerInputs): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch {
    /* storage unavailable (private mode, quota) - the app still works */
  }
}

/** Load previously saved inputs, or null when nothing usable is stored. */
export function loadInputs(): HeatExchangerInputs | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normaliseInputs(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Remove the saved inputs. */
export function clearInputs(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
