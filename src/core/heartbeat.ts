import { isPlainObject } from './processors/merge.js';

export type HeartbeatState = Record<string, unknown> & {
  Utc?: string | null;
};

export type HeartbeatSnapshot = {
  utc: string | null;
};

function asRecord<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown,
): T | null {
  return isPlainObject(value) ? (value as T) : null;
}

function toOptionalIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = new Date(trimmed);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function getHeartbeatUtc(value: unknown): string | null {
  const root = asRecord(value);
  if (!root) {
    return null;
  }
  return (
    toOptionalIsoString(root.Utc) ??
    toOptionalIsoString(root.UtcTime) ??
    toOptionalIsoString(root.utc)
  );
}

export function getHeartbeatDate(value: unknown): Date | null {
  const utc = getHeartbeatUtc(value);
  if (!utc) {
    return null;
  }
  const parsed = new Date(utc);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function getHeartbeatSnapshot(value: unknown): HeartbeatSnapshot | null {
  const utc = getHeartbeatUtc(value);
  if (!utc) {
    return null;
  }
  return { utc };
}

export function replaceHeartbeatState(value: unknown): HeartbeatState | null {
  const root = asRecord<HeartbeatState>(value);
  if (!root) {
    return null;
  }

  const next = structuredClone(root) as Record<string, unknown>;
  const utc = getHeartbeatUtc(root);
  delete next.UtcTime;
  delete next.utc;
  if (utc === null) {
    delete next.Utc;
  } else {
    next.Utc = utc;
  }
  return next as HeartbeatState;
}
