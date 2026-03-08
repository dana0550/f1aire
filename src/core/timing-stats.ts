import { isPlainObject, mergeDeep } from './processors/merge.js';

export type TimingStatsBestSpeed = Record<string, unknown> & {
  Value?: string | number | null;
  Position?: string | number | null;
};

export type TimingStatsLine = Record<string, unknown> & {
  BestSpeeds?: Record<string, TimingStatsBestSpeed>;
  Speeds?: Record<string, TimingStatsBestSpeed>;
};

export type TimingStatsState = Record<string, unknown> & {
  Lines?: Record<string, TimingStatsLine>;
};

export type TimingStatsDriverBestSpeed = {
  trap: string;
  position: number | null;
  value: string | null;
  speedKph: number | null;
  raw: TimingStatsBestSpeed;
};

export type TimingStatsDriverRecord = {
  driverNumber: string;
  driverName: string | null;
  bestSpeeds: TimingStatsDriverBestSpeed[];
  raw: TimingStatsLine;
};

export type TimingStatsTrapRecord = {
  trap: string;
  driverNumber: string;
  driverName: string | null;
  position: number | null;
  value: string | null;
  speedKph: number | null;
  raw: TimingStatsBestSpeed;
};

export type TimingStatsTrapTable = {
  trap: string;
  totalDrivers: number;
  fastest: TimingStatsTrapRecord | null;
  records: TimingStatsTrapRecord[];
};

type DriverListState = Record<string, unknown> | null | undefined;

const PREFERRED_TRAP_ORDER = ['FL', 'I1', 'I2', 'ST'];

function cloneState(state: TimingStatsState): TimingStatsState {
  return structuredClone(state) as TimingStatsState;
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

function compareMaybeNumericStrings(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

function compareTrapNames(left: string, right: string) {
  const leftIndex = PREFERRED_TRAP_ORDER.indexOf(left);
  const rightIndex = PREFERRED_TRAP_ORDER.indexOf(right);
  if (leftIndex !== -1 || rightIndex !== -1) {
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
  }
  return left.localeCompare(right);
}

function normalizeTrapKey(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function getLinesRoot(state: unknown): Record<string, TimingStatsLine> {
  if (!isPlainObject((state as { Lines?: unknown } | null)?.Lines)) {
    return {};
  }
  return (state as { Lines: Record<string, TimingStatsLine> }).Lines ?? {};
}

function getSpeedEntries(
  line: TimingStatsLine | null | undefined,
): Array<[string, TimingStatsBestSpeed]> {
  if (!line) {
    return [];
  }

  const source = isPlainObject(line.BestSpeeds)
    ? line.BestSpeeds
    : isPlainObject(line.Speeds)
      ? line.Speeds
      : null;
  if (!source) {
    return [];
  }

  const speeds = new Map<string, TimingStatsBestSpeed>();
  for (const [rawTrap, rawValue] of Object.entries(source)) {
    const trap = normalizeTrapKey(rawTrap);
    if (!trap || !isPlainObject(rawValue)) {
      continue;
    }
    speeds.set(trap, rawValue as TimingStatsBestSpeed);
  }

  return Array.from(speeds.entries()).sort(([left], [right]) =>
    compareTrapNames(left, right),
  );
}

function getTrapKeys(state: unknown) {
  const traps = new Set<string>();
  for (const line of Object.values(getLinesRoot(state))) {
    for (const [trap] of getSpeedEntries(line)) {
      traps.add(trap);
    }
  }
  return Array.from(traps).sort(compareTrapNames);
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

function toDriverBestSpeed(
  trap: string,
  raw: TimingStatsBestSpeed,
): TimingStatsDriverBestSpeed {
  return {
    trap,
    position: toNumber(raw.Position),
    value: toText(raw.Value),
    speedKph: toNumber(raw.Value),
    raw: structuredClone(raw) as TimingStatsBestSpeed,
  };
}

function toTrapRecord(opts: {
  trap: string;
  driverNumber: string;
  driverName: string | null;
  raw: TimingStatsBestSpeed;
}): TimingStatsTrapRecord {
  return {
    trap: opts.trap,
    driverNumber: opts.driverNumber,
    driverName: opts.driverName,
    position: toNumber(opts.raw.Position),
    value: toText(opts.raw.Value),
    speedKph: toNumber(opts.raw.Value),
    raw: structuredClone(opts.raw) as TimingStatsBestSpeed,
  };
}

function compareTrapRecords(
  left: TimingStatsTrapRecord,
  right: TimingStatsTrapRecord,
) {
  if (left.position !== null && right.position !== null) {
    if (left.position !== right.position) {
      return left.position - right.position;
    }
  } else if (left.position !== null) {
    return -1;
  } else if (right.position !== null) {
    return 1;
  }

  if (left.speedKph !== null && right.speedKph !== null) {
    if (left.speedKph !== right.speedKph) {
      return right.speedKph - left.speedKph;
    }
  } else if (left.speedKph !== null) {
    return -1;
  } else if (right.speedKph !== null) {
    return 1;
  }

  return compareMaybeNumericStrings(left.driverNumber, right.driverNumber);
}

export function mergeTimingStatsState(
  current: TimingStatsState | null,
  patch: unknown,
): TimingStatsState | null {
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

export function buildTimingStatsState(opts: {
  baseState?: unknown;
  timeline?: Array<{ json: unknown }>;
}): TimingStatsState | null {
  let state = mergeTimingStatsState(null, opts.baseState ?? null);
  for (const point of opts.timeline ?? []) {
    state = mergeTimingStatsState(state, point?.json ?? null);
  }
  return state;
}

export function getTimingStatsDriver(opts: {
  state: unknown;
  driverListState?: DriverListState;
  driverNumber: string | number;
}): TimingStatsDriverRecord | null {
  const driverNumber = String(opts.driverNumber);
  const line = getLinesRoot(opts.state)[driverNumber];
  if (!isPlainObject(line)) {
    return null;
  }

  return {
    driverNumber,
    driverName: getDriverName(opts.driverListState, driverNumber),
    bestSpeeds: getSpeedEntries(line).map(([trap, raw]) =>
      toDriverBestSpeed(trap, raw),
    ),
    raw: structuredClone(line) as TimingStatsLine,
  };
}

export function getTimingStatsTrapTable(opts: {
  state: unknown;
  driverListState?: DriverListState;
  trap: string;
  limit?: number;
}): TimingStatsTrapTable | null {
  const requestedTrap = normalizeTrapKey(opts.trap);
  if (!requestedTrap) {
    return null;
  }

  const records = Object.entries(getLinesRoot(opts.state))
    .map(([driverNumber, rawLine]) => {
      if (!isPlainObject(rawLine)) {
        return null;
      }

      const speed = getSpeedEntries(rawLine).find(
        ([trap]) => trap === requestedTrap,
      )?.[1];
      if (!speed) {
        return null;
      }

      return toTrapRecord({
        trap: requestedTrap,
        driverNumber,
        driverName: getDriverName(opts.driverListState, driverNumber),
        raw: speed,
      });
    })
    .filter((record): record is TimingStatsTrapRecord => record !== null)
    .sort(compareTrapRecords);

  if (records.length === 0) {
    return null;
  }

  const limited =
    typeof opts.limit === 'number' && opts.limit > 0
      ? records.slice(0, opts.limit)
      : records;

  return {
    trap: requestedTrap,
    totalDrivers: records.length,
    fastest: records[0] ?? null,
    records: limited,
  };
}

export function getTimingStatsTrapTables(opts: {
  state: unknown;
  driverListState?: DriverListState;
  limit?: number;
}): TimingStatsTrapTable[] {
  return getTrapKeys(opts.state)
    .map((trap) =>
      getTimingStatsTrapTable({
        state: opts.state,
        driverListState: opts.driverListState,
        trap,
        limit: opts.limit,
      }),
    )
    .filter((table): table is TimingStatsTrapTable => table !== null);
}
