import { isPlainObject } from './processors/merge.js';

export const TIMING_DATA_TYPES = ['TimingData', 'TimingDataF1'] as const;

export type TimingPointType = (typeof TIMING_DATA_TYPES)[number];

export type TimingSegment = Record<string, unknown> & {
  Status?: string | number | null;
};

export type TimingSector = Record<string, unknown> & {
  Value?: string | number | null;
  PreviousValue?: string | number | null;
  Segments?: Record<string, TimingSegment> | TimingSegment[] | null;
};

export type TimingInterval = Record<string, unknown> & {
  Value?: string | number | null;
  Catching?: boolean | string | number | null;
};

export type TimingBestLap = Record<string, unknown> & {
  Value?: string | number | null;
  Lap?: string | number | null;
};

export type TimingSpeedValue = Record<string, unknown> & {
  Value?: string | number | null;
  Position?: string | number | null;
};

export type TimingLine = Record<string, unknown> & {
  GapToLeader?: string | number | null;
  IntervalToPositionAhead?: TimingInterval | null;
  Line?: string | number | null;
  Position?: string | number | null;
  PitIn?: boolean | string | number | null;
  InPit?: boolean | string | number | null;
  PitOut?: boolean | string | number | null;
  NumberOfPitStops?: string | number | null;
  NumberOfLaps?: string | number | null;
  LastLapTime?: TimingSector | null;
  LapTime?: TimingSector | null;
  Sectors?: Record<string, TimingSector> | TimingSector[] | null;
  BestLapTime?: TimingBestLap | null;
  KnockedOut?: boolean | string | number | null;
  Retired?: boolean | string | number | null;
  Stopped?: boolean | string | number | null;
  Status?: string | number | null;
  SessionPart?: string | number | null;
  IsPitLap?: boolean | string | number | null;
  Speeds?: Record<string, TimingSpeedValue> | null;
  __dateTime?: Date | string | null;
};

export type TimingState = Record<string, unknown> & {
  SessionPart?: string | number | null;
  Lines?: Record<string, TimingLine> | TimingLine[] | null;
};

function compareMaybeNumericStrings(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

function arrayToIndexedObject<T>(value: T[]) {
  const out: Record<string, T> = {};
  value.forEach((entry, index) => {
    out[String(index)] = entry;
  });
  return out;
}

export function isTimingDataPointType(type: string): type is TimingPointType {
  return TIMING_DATA_TYPES.includes(type as TimingPointType);
}

export function toTimingText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toTimingNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toTimingBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value !== 0;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed !== 0 : null;
}

export function isTimingFlagActive(value: unknown) {
  return toTimingBoolean(value) ?? false;
}

export function getTimingSessionPart(value: unknown): number | null {
  if (!isPlainObject(value)) {
    return null;
  }
  return toTimingNumber(value.SessionPart);
}

export function getTimingLinesRoot(state: unknown): Record<string, TimingLine> {
  if (!isPlainObject(state)) {
    return {};
  }

  const rawLines = state.Lines;
  const lines = Array.isArray(rawLines)
    ? arrayToIndexedObject(rawLines)
    : isPlainObject(rawLines)
      ? rawLines
      : null;
  if (!lines) {
    return {};
  }

  const out: Record<string, TimingLine> = {};
  for (const [driverNumber, rawLine] of Object.entries(lines)) {
    if (driverNumber === '_kf' || !isPlainObject(rawLine)) {
      continue;
    }
    out[driverNumber] = rawLine as TimingLine;
  }
  return out;
}

export function getTimingLineOrder(line: unknown): number | null {
  if (!isPlainObject(line)) {
    return null;
  }
  return toTimingNumber(line.Line ?? line.Position);
}

export function getTimingLineLapNumber(line: unknown): number | null {
  if (!isPlainObject(line)) {
    return null;
  }
  return toTimingNumber(line.NumberOfLaps);
}

export function getTimingLineGapToLeader(line: unknown): string | null {
  if (!isPlainObject(line)) {
    return null;
  }
  return toTimingText(line.GapToLeader);
}

export function getTimingLineIntervalToAhead(line: unknown): string | null {
  if (!isPlainObject(line) || !isPlainObject(line.IntervalToPositionAhead)) {
    return null;
  }
  return toTimingText(line.IntervalToPositionAhead.Value);
}

export function getTimingLineBestLapTime(line: unknown): string | null {
  if (!isPlainObject(line) || !isPlainObject(line.BestLapTime)) {
    return null;
  }
  return toTimingText(line.BestLapTime.Value);
}

export function getTimingLineBestLapNumber(line: unknown): number | null {
  if (!isPlainObject(line) || !isPlainObject(line.BestLapTime)) {
    return null;
  }
  return toTimingNumber(line.BestLapTime.Lap);
}

export function getTimingLineLastLapTime(line: unknown): string | null {
  if (!isPlainObject(line) || !isPlainObject(line.LastLapTime)) {
    return null;
  }
  return toTimingText(line.LastLapTime.Value);
}

export function getTimingLineLapTime(line: unknown): string | null {
  if (!isPlainObject(line) || !isPlainObject(line.LapTime)) {
    return null;
  }
  return toTimingText(line.LapTime.Value);
}

export function getTimingLineDateTime(line: unknown): Date | null {
  if (!isPlainObject(line)) {
    return null;
  }

  const value = line.__dateTime;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function getTimingLineSpeeds(
  line: unknown,
): Record<string, TimingSpeedValue> {
  if (!isPlainObject(line) || !isPlainObject(line.Speeds)) {
    return {};
  }

  const out: Record<string, TimingSpeedValue> = {};
  for (const [key, rawValue] of Object.entries(line.Speeds)) {
    if (!isPlainObject(rawValue)) {
      continue;
    }
    out[key] = rawValue as TimingSpeedValue;
  }
  return out;
}

export function getTimingSectors(line: unknown): TimingSector[] {
  if (!isPlainObject(line)) {
    return [];
  }

  const rawSectors = line.Sectors;
  const sectors = Array.isArray(rawSectors)
    ? rawSectors
    : isPlainObject(rawSectors)
      ? Object.entries(rawSectors)
          .filter(([key]) => key !== '_kf')
          .sort(([left], [right]) => compareMaybeNumericStrings(left, right))
          .map(([, value]) => value)
      : [];

  return sectors.filter((sector): sector is TimingSector =>
    isPlainObject(sector),
  );
}

export function getTimingSegments(sector: unknown): TimingSegment[] {
  if (!isPlainObject(sector)) {
    return [];
  }

  const rawSegments = sector.Segments;
  const segments = Array.isArray(rawSegments)
    ? rawSegments
    : isPlainObject(rawSegments)
      ? Object.entries(rawSegments)
          .filter(([key]) => key !== '_kf')
          .sort(([left], [right]) => compareMaybeNumericStrings(left, right))
          .map(([, value]) => value)
      : [];

  return segments.filter((segment): segment is TimingSegment =>
    isPlainObject(segment),
  );
}

export function getOrderedTimingLines(
  lines: Record<string, TimingLine>,
): Array<[string, TimingLine]> {
  return Object.entries(lines).sort(
    ([leftNumber, left], [rightNumber, right]) => {
      const leftOrder = getTimingLineOrder(left);
      const rightOrder = getTimingLineOrder(right);
      if (leftOrder !== null || rightOrder !== null) {
        if (leftOrder === null) {
          return 1;
        }
        if (rightOrder === null) {
          return -1;
        }
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
      }
      return compareMaybeNumericStrings(leftNumber, rightNumber);
    },
  );
}
