import { parseGapSeconds, parseIntervalSeconds } from './analysis-utils.js';
import { isPlainObject, mergeDeep } from './processors/merge.js';

export type DriverTrackerLine = Record<string, unknown> & {
  Position?: string | number | null;
  ShowPosition?: boolean | number | string | null;
  RacingNumber?: string | number | null;
  LapTime?: string | number | null;
  LapState?: string | number | null;
  DiffToAhead?: string | number | null;
  DiffToLeader?: string | number | null;
  OverallFastest?: boolean | number | string | null;
  PersonalFastest?: boolean | number | string | null;
};

export type DriverTrackerState = Record<string, unknown> & {
  SessionPart?: string | number | null;
  Withheld?: boolean | number | string | null;
  Lines?: Record<string, DriverTrackerLine>;
};

export type DriverTrackerMeta = {
  withheld: boolean | null;
  sessionPart: number | null;
};

export type DriverTrackerRow = {
  lineIndex: number | null;
  driverNumber: string | null;
  driverName: string | null;
  position: number | null;
  showPosition: boolean | null;
  lapTime: string | null;
  lapState: number | null;
  diffToAhead: string | null;
  diffToAheadSeconds: number | null;
  diffToLeader: string | null;
  diffToLeaderSeconds: number | null;
  overallFastest: boolean | null;
  personalFastest: boolean | null;
  raw: DriverTrackerLine;
};

type DriverListState = Record<string, unknown> | null | undefined;

function cloneState(state: DriverTrackerState): DriverTrackerState {
  return structuredClone(state) as DriverTrackerState;
}

function arrayToIndexedObject<T>(value: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  value.forEach((entry, index) => {
    out[String(index)] = entry;
  });
  return out;
}

function normalizeDriverTrackerPatch(
  patch: DriverTrackerState,
): DriverTrackerState {
  const next = structuredClone(patch) as DriverTrackerState;
  if (Array.isArray(next.Lines)) {
    next.Lines = arrayToIndexedObject(next.Lines as DriverTrackerLine[]);
  }
  return next;
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }
  return null;
}

function compareMaybeNumericStrings(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

function toOrderedEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.map((entry, index) => [String(index), entry]);
  }
  if (!isPlainObject(value)) {
    return [];
  }
  return Object.entries(value)
    .filter(([key]) => key !== '_kf')
    .sort(([left], [right]) => compareMaybeNumericStrings(left, right));
}

function getLinesRoot(state: unknown): unknown {
  const lines = (state as { Lines?: unknown } | null)?.Lines;
  if (isPlainObject(lines) || Array.isArray(lines)) {
    return lines;
  }
  return null;
}

function getDriverName(driverListState: DriverListState, driverNumber: string) {
  if (!isPlainObject(driverListState)) {
    return null;
  }
  const raw = driverListState[driverNumber];
  if (!isPlainObject(raw)) {
    return null;
  }
  return (
    toText(raw.FullName) ?? toText(raw.BroadcastName) ?? toText(raw.Tla) ?? null
  );
}

export function mergeDriverTrackerState(
  current: DriverTrackerState | null,
  patch: unknown,
): DriverTrackerState | null {
  if (!isPlainObject(patch)) {
    return current ? cloneState(current) : null;
  }

  const next = current ? cloneState(current) : {};
  const normalized = normalizeDriverTrackerPatch(patch as DriverTrackerState);

  if (
    'Lines' in normalized &&
    isPlainObject(normalized.Lines) &&
    Object.keys(normalized.Lines).filter((key) => key !== '_kf').length === 0
  ) {
    next.Lines = {};
  }

  mergeDeep(
    next as Record<string, unknown>,
    normalized as Record<string, unknown>,
  );
  return next;
}

export function buildDriverTrackerState(opts: {
  baseState?: unknown;
  timeline?: Array<{ json: unknown }>;
}): DriverTrackerState | null {
  let state = mergeDriverTrackerState(null, opts.baseState ?? null);
  for (const point of opts.timeline ?? []) {
    state = mergeDriverTrackerState(state, point?.json ?? null);
  }
  return state;
}

export function getDriverTrackerMeta(state: unknown): DriverTrackerMeta {
  const root = isPlainObject(state) ? state : null;
  return {
    withheld: toBoolean(root?.Withheld),
    sessionPart: toNumber(root?.SessionPart),
  };
}

export function getDriverTrackerRows(opts: {
  state: unknown;
  driverListState?: DriverListState;
  driverNumber?: string | number;
}): DriverTrackerRow[] {
  const requestedDriver =
    opts.driverNumber === undefined ? null : String(opts.driverNumber);

  const rows = toOrderedEntries(getLinesRoot(opts.state))
    .map(([lineKey, raw]) => {
      if (!isPlainObject(raw)) {
        return null;
      }

      const line = raw as DriverTrackerLine;
      const driverNumber = toText(line.RacingNumber);
      if (requestedDriver !== null && driverNumber !== requestedDriver) {
        return null;
      }

      const diffToAhead = toText(line.DiffToAhead);
      const diffToLeader = toText(line.DiffToLeader);
      return {
        lineIndex: toNumber(lineKey),
        driverNumber,
        driverName: driverNumber
          ? getDriverName(opts.driverListState, driverNumber)
          : null,
        position: toNumber(line.Position),
        showPosition: toBoolean(line.ShowPosition),
        lapTime: toText(line.LapTime),
        lapState: toNumber(line.LapState),
        diffToAhead,
        diffToAheadSeconds: parseIntervalSeconds(diffToAhead),
        diffToLeader,
        diffToLeaderSeconds: parseGapSeconds(diffToLeader),
        overallFastest: toBoolean(line.OverallFastest),
        personalFastest: toBoolean(line.PersonalFastest),
        raw: structuredClone(line) as DriverTrackerLine,
      } satisfies DriverTrackerRow;
    })
    .filter((row): row is DriverTrackerRow => row !== null);

  rows.sort((left, right) => {
    if (left.lineIndex !== null && right.lineIndex !== null) {
      return left.lineIndex - right.lineIndex;
    }
    if (left.lineIndex !== null) {
      return -1;
    }
    if (right.lineIndex !== null) {
      return 1;
    }
    return (left.driverNumber ?? '').localeCompare(
      right.driverNumber ?? '',
      undefined,
      {
        numeric: true,
      },
    );
  });

  return rows;
}
