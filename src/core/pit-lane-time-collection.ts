import { isPlainObject } from './processors/merge.js';

export type PitLaneTimeEntry = Record<string, unknown> & {
  RacingNumber?: string | number | null;
  Duration?: string | number | null;
  Lap?: string | number | null;
};

export type PitLaneTimeCollectionState = {
  PitTimes?: Record<string, PitLaneTimeEntry>;
  PitTimesList?: Record<string, PitLaneTimeEntry[]>;
};

export type PitLaneTimeRecord = {
  driverNumber: string;
  lap: number | null;
  duration: string | null;
  durationMs: number | null;
  raw: PitLaneTimeEntry;
};

function cloneState(
  state: PitLaneTimeCollectionState,
): PitLaneTimeCollectionState {
  return structuredClone(state) as PitLaneTimeCollectionState;
}

function compareMaybeNumericStrings(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

function toOptionalString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
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

function normalizePitLaneTimeEntry(
  value: unknown,
  driverNumber: string,
): PitLaneTimeEntry | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const entry = structuredClone(value) as PitLaneTimeEntry;
  entry.RacingNumber = toOptionalString(entry.RacingNumber) ?? driverNumber;
  return entry;
}

function normalizePitLaneTimeEntries(
  value: unknown,
  driverNumber: string,
): PitLaneTimeEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizePitLaneTimeEntry(entry, driverNumber))
    .filter((entry): entry is PitLaneTimeEntry => entry !== null);
}

export function parseDurationMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 1000) : null;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const text = raw.replace(/^[+]/, '');
  if (/^\d+(\.\d+)?$/.test(text)) {
    const sec = Number(text);
    return Number.isFinite(sec) ? Math.round(sec * 1000) : null;
  }
  if (!text.includes(':')) return null;
  const parts = text.split(':').map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) return null;
  const seconds = Number(parts[parts.length - 1]);
  if (!Number.isFinite(seconds)) return null;
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    if (!Number.isFinite(minutes)) return null;
    return Math.round((minutes * 60 + seconds) * 1000);
  }
  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }
  return null;
}

export function mergePitLaneTimeCollectionState(
  current: PitLaneTimeCollectionState | null,
  patch: unknown,
): PitLaneTimeCollectionState | null {
  if (!isPlainObject(patch)) {
    return current ? cloneState(current) : null;
  }

  const next = current ? cloneState(current) : {};
  const pitTimes = isPlainObject(next.PitTimes)
    ? next.PitTimes
    : ((next.PitTimes = {}), next.PitTimes);
  const pitTimesList = isPlainObject(next.PitTimesList)
    ? next.PitTimesList
    : ((next.PitTimesList = {}), next.PitTimesList);

  const patchPitTimesList = isPlainObject(patch.PitTimesList)
    ? patch.PitTimesList
    : null;
  if (patchPitTimesList) {
    for (const [driverKey, rawEntries] of Object.entries(patchPitTimesList)) {
      if (driverKey === '_deleted') {
        continue;
      }

      const normalizedEntries = normalizePitLaneTimeEntries(
        rawEntries,
        driverKey,
      );
      if (normalizedEntries.length === 0) {
        continue;
      }

      const canonicalDriver =
        toOptionalString(
          normalizedEntries[normalizedEntries.length - 1]?.RacingNumber,
        ) ?? driverKey;
      pitTimesList[canonicalDriver] = normalizedEntries;
      pitTimes[canonicalDriver] = structuredClone(
        normalizedEntries[normalizedEntries.length - 1]!,
      ) as PitLaneTimeEntry;
    }
  }

  const patchPitTimes = isPlainObject(patch.PitTimes) ? patch.PitTimes : null;
  if (patchPitTimes) {
    for (const [driverKey, rawEntry] of Object.entries(patchPitTimes)) {
      if (driverKey === '_deleted') {
        continue;
      }

      const entry = normalizePitLaneTimeEntry(rawEntry, driverKey);
      if (!entry) {
        continue;
      }

      const canonicalDriver = toOptionalString(entry.RacingNumber) ?? driverKey;
      pitTimes[canonicalDriver] = structuredClone(entry) as PitLaneTimeEntry;
      if (!patchPitTimesList) {
        const existing = Array.isArray(pitTimesList[canonicalDriver])
          ? pitTimesList[canonicalDriver]
          : [];
        pitTimesList[canonicalDriver] = [
          ...existing,
          structuredClone(entry) as PitLaneTimeEntry,
        ];
      }
    }
  }

  return next;
}

export function buildPitLaneTimeCollectionState(opts: {
  baseState?: unknown;
  timeline?: Array<{ json: unknown }>;
}): PitLaneTimeCollectionState | null {
  let state = mergePitLaneTimeCollectionState(null, opts.baseState ?? null);
  for (const point of opts.timeline ?? []) {
    state = mergePitLaneTimeCollectionState(state, point?.json ?? null);
  }
  return state;
}

export function getPitLaneTimeRecords(opts: {
  state?: unknown;
  driverNumber?: string | number;
  startLap?: number;
  endLap?: number;
}): PitLaneTimeRecord[] {
  const state = buildPitLaneTimeCollectionState({ baseState: opts.state });
  if (!state?.PitTimesList || !isPlainObject(state.PitTimesList)) {
    return [];
  }

  const requestedDriver =
    opts.driverNumber === undefined ? null : String(opts.driverNumber);
  const startLap = typeof opts.startLap === 'number' ? opts.startLap : null;
  const endLap = typeof opts.endLap === 'number' ? opts.endLap : null;

  const records: PitLaneTimeRecord[] = [];
  for (const driverNumber of Object.keys(state.PitTimesList).sort(
    compareMaybeNumericStrings,
  )) {
    if (requestedDriver !== null && driverNumber !== requestedDriver) {
      continue;
    }

    const entries = state.PitTimesList[driverNumber];
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      const lap = toOptionalNumber(entry.Lap);
      if (startLap !== null && lap !== null && lap < startLap) {
        continue;
      }
      if (endLap !== null && lap !== null && lap > endLap) {
        continue;
      }

      records.push({
        driverNumber,
        lap,
        duration: toOptionalString(entry.Duration),
        durationMs: parseDurationMs(entry.Duration),
        raw: structuredClone(entry) as PitLaneTimeEntry,
      });
    }
  }

  return records;
}
