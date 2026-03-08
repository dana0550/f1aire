import { isPlainObject } from './processors/merge.js';

export type LapSeriesSource = 'LapSeries';

export type LapSeriesPositionRecord = {
  driverNumber: string;
  lap: number;
  position: number | null;
  source: LapSeriesSource;
};

export type LapSeriesSummary = {
  driverNumber: string;
  totalLaps: number;
  startLap: number | null;
  endLap: number | null;
  startPosition: number | null;
  endPosition: number | null;
  bestPosition: number | null;
  worstPosition: number | null;
  positionsGained: number | null;
  changes: number;
};

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

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getLapSeriesRoot(state: unknown): Record<string, unknown> {
  if (isPlainObject((state as { Lines?: unknown } | null)?.Lines)) {
    return (state as { Lines: Record<string, unknown> }).Lines;
  }
  if (isPlainObject(state)) {
    return state as Record<string, unknown>;
  }
  return {};
}

function buildDriverLapSeriesRecords(
  driverKey: string,
  raw: unknown,
): LapSeriesPositionRecord[] {
  if (!isPlainObject(raw)) {
    return [];
  }

  const driverNumber = toOptionalString(raw.RacingNumber) ?? driverKey;
  const lapPosition = raw.LapPosition;

  return toOrderedEntries(lapPosition)
    .map(([lapKey, value]) => {
      const lapIndex = Number(lapKey);
      if (!Number.isFinite(lapIndex)) {
        return null;
      }

      const position = isPlainObject(value)
        ? toOptionalNumber(value.Position ?? value.Value ?? value.Pos)
        : toOptionalNumber(value);

      return {
        driverNumber,
        lap: lapIndex + 1,
        position,
        source: 'LapSeries' as const,
      };
    })
    .filter((record): record is LapSeriesPositionRecord => record !== null)
    .sort((left, right) => left.lap - right.lap);
}

function pickBestPosition(records: LapSeriesPositionRecord[]) {
  const positions = records
    .map((record) => record.position)
    .filter((position): position is number => position !== null);
  if (!positions.length) {
    return null;
  }
  return Math.min(...positions);
}

function pickWorstPosition(records: LapSeriesPositionRecord[]) {
  const positions = records
    .map((record) => record.position)
    .filter((position): position is number => position !== null);
  if (!positions.length) {
    return null;
  }
  return Math.max(...positions);
}

export function getLapSeriesRecords(opts: {
  lapSeriesState?: unknown;
  driverNumber?: string | number;
  startLap?: number;
  endLap?: number;
}): LapSeriesPositionRecord[] {
  const requestedDriver =
    opts.driverNumber === undefined ? null : String(opts.driverNumber);
  const startLap = typeof opts.startLap === 'number' ? opts.startLap : null;
  const endLap = typeof opts.endLap === 'number' ? opts.endLap : null;

  const records: LapSeriesPositionRecord[] = [];

  for (const [driverKey, raw] of Object.entries(
    getLapSeriesRoot(opts.lapSeriesState),
  ).sort(([left], [right]) => compareMaybeNumericStrings(left, right))) {
    const driverRecords = buildDriverLapSeriesRecords(driverKey, raw).filter(
      (record) => {
        if (requestedDriver && record.driverNumber !== requestedDriver) {
          return false;
        }
        if (startLap !== null && record.lap < startLap) {
          return false;
        }
        if (endLap !== null && record.lap > endLap) {
          return false;
        }
        return true;
      },
    );
    records.push(...driverRecords);
  }

  return records.sort((left, right) => {
    if (left.driverNumber !== right.driverNumber) {
      return compareMaybeNumericStrings(left.driverNumber, right.driverNumber);
    }
    return left.lap - right.lap;
  });
}

export function summarizeLapSeries(
  records: LapSeriesPositionRecord[],
): LapSeriesSummary | null {
  if (!records.length) {
    return null;
  }

  const ordered = [...records].sort((left, right) => left.lap - right.lap);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  let changes = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (
      previous.position !== null &&
      current.position !== null &&
      previous.position !== current.position
    ) {
      changes += 1;
    }
  }

  return {
    driverNumber: first.driverNumber,
    totalLaps: ordered.length,
    startLap: first.lap,
    endLap: last.lap,
    startPosition: first.position,
    endPosition: last.position,
    bestPosition: pickBestPosition(ordered),
    worstPosition: pickWorstPosition(ordered),
    positionsGained:
      first.position !== null && last.position !== null
        ? first.position - last.position
        : null,
    changes,
  };
}
