import { isPlainObject } from './processors/merge.js';

export type LapCountState = Record<string, unknown> & {
  CurrentLap?: number | null;
  TotalLaps?: number | null;
};

export type LapCountSnapshot = {
  currentLap: number | null;
  totalLaps: number | null;
  lapsRemaining: number | null;
};

function asRecord<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown,
): T | null {
  return isPlainObject(value) ? (value as T) : null;
}

function toOptionalInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export function getCurrentLap(value: unknown): number | null {
  const root = asRecord(value);
  if (!root) {
    return null;
  }
  return toOptionalInteger(root.CurrentLap);
}

export function getTotalLaps(value: unknown): number | null {
  const root = asRecord(value);
  if (!root) {
    return null;
  }
  return toOptionalInteger(root.TotalLaps);
}

export function getLapCountSnapshot(value: unknown): LapCountSnapshot | null {
  const root = asRecord(value);
  if (!root) {
    return null;
  }

  const currentLap = getCurrentLap(root);
  const totalLaps = getTotalLaps(root);
  return {
    currentLap,
    totalLaps,
    lapsRemaining:
      currentLap !== null && totalLaps !== null
        ? Math.max(totalLaps - currentLap, 0)
        : null,
  };
}

export function replaceLapCountState(value: unknown): LapCountState | null {
  const root = asRecord<LapCountState>(value);
  if (!root) {
    return null;
  }

  const next = structuredClone(root) as Record<string, unknown>;
  const currentLap = getCurrentLap(root);
  const totalLaps = getTotalLaps(root);

  if (currentLap === null) {
    delete next.CurrentLap;
  } else {
    next.CurrentLap = currentLap;
  }

  if (totalLaps === null) {
    delete next.TotalLaps;
  } else {
    next.TotalLaps = totalLaps;
  }

  return next as LapCountState;
}
