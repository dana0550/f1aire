import { isPlainObject, mergeDeep } from './processors/merge.js';

export type TimingAppDataStint = Record<string, unknown> & {
  Compound?: string | null;
  New?: boolean | string | number | null;
  TyresNotChanged?: boolean | string | number | null;
  StartLaps?: number | string | null;
  TotalLaps?: number | string | null;
  LapTime?: string | null;
  LapNumber?: number | string | null;
};

export type TimingAppDataLine = Record<string, unknown> & {
  RacingNumber?: string | number | null;
  Line?: string | number | null;
  Position?: string | number | null;
  Stints?: Record<string, TimingAppDataStint> | null;
};

export type TimingAppDataState = Record<string, unknown> & {
  Lines?: Record<string, TimingAppDataLine> | null;
};

function cloneState(state: TimingAppDataState): TimingAppDataState {
  return structuredClone(state) as TimingAppDataState;
}

function compareMaybeNumericStrings(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

function asRecord<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown,
): T | null {
  return isPlainObject(value) ? (value as T) : null;
}

export function mergeTimingAppDataState(
  current: TimingAppDataState | null,
  patch: unknown,
): TimingAppDataState | null {
  if (!isPlainObject(patch)) {
    return current ? cloneState(current) : null;
  }

  const next = current ? cloneState(current) : {};
  mergeDeep(
    next as Record<string, unknown>,
    structuredClone(patch) as Record<string, unknown>,
  );
  return next;
}

export function buildTimingAppDataState(opts: {
  baseState?: unknown;
  timeline?: Array<{ json: unknown }>;
}): TimingAppDataState | null {
  let state = mergeTimingAppDataState(null, opts.baseState ?? null);
  for (const point of opts.timeline ?? []) {
    state = mergeTimingAppDataState(state, point?.json ?? null);
  }
  return state;
}

export function getTimingAppDataLinesRoot(
  state: unknown,
): Record<string, TimingAppDataLine> {
  const root = asRecord<TimingAppDataState>(state);
  return asRecord<Record<string, TimingAppDataLine>>(root?.Lines) ?? {};
}

export function getTimingAppDataLine(
  state: unknown,
  driverNumber: string | number,
): TimingAppDataLine | null {
  return getTimingAppDataLinesRoot(state)[String(driverNumber)] ?? null;
}

export function getTimingAppDataStints(
  line: unknown,
): Array<[string, TimingAppDataStint]> {
  const root = asRecord<TimingAppDataLine>(line);
  const stints = asRecord<Record<string, TimingAppDataStint>>(root?.Stints);
  if (!stints) {
    return [];
  }

  return Object.entries(stints)
    .filter(([stintKey]) => stintKey !== '_kf')
    .sort(([left], [right]) => compareMaybeNumericStrings(left, right));
}

export function getTimingAppDataStint(
  state: unknown,
  driverNumber: string | number,
  stint: string | number,
): TimingAppDataStint | null {
  const line = getTimingAppDataLine(state, driverNumber);
  return asRecord<TimingAppDataStint>(line?.Stints?.[String(stint)]);
}
