import { isPlainObject, mergeDeep } from './merge.js';
import type { Processor, RawPoint } from './types.js';

export type RaceControlMessageRecord = Record<string, unknown> & {
  Utc?: string | null;
  Lap?: string | number | null;
  Category?: string | null;
  Flag?: string | null;
  Scope?: string | null;
  Sector?: string | number | null;
  Status?: string | null;
  RacingNumber?: string | number | null;
  Message?: string | null;
};

export type RaceControlMessagesState = Record<string, unknown> & {
  Messages?: Record<string, RaceControlMessageRecord>;
};

export type RaceControlEvent = {
  messageId: string;
  utc: string | null;
  dateTime: Date | null;
  lap: number | null;
  category: string | null;
  flag: string | null;
  scope: string | null;
  sector: number | null;
  status: string | null;
  driverNumber: string | null;
  message: string | null;
};

export type RaceControlEventQuery = {
  before?: Date | string | null;
  category?: string;
  flag?: string;
  scope?: string;
  driverNumber?: string | number;
  search?: string;
  limit?: number;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
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

function normalizeComparable(value: string | null | undefined): string | null {
  return value ? value.trim().toLowerCase() : null;
}

function matchesExact(actual: string | null, expected?: string) {
  if (expected === undefined) {
    return true;
  }
  const normalizedExpected = normalizeComparable(expected);
  if (!normalizedExpected) {
    return true;
  }
  return normalizeComparable(actual) === normalizedExpected;
}

function compareMessageIds(left: string, right: string): number {
  const leftNum = Number(left);
  const rightNum = Number(right);
  if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
    return rightNum - leftNum;
  }
  return right.localeCompare(left);
}

function arrayToIndexedObject<T>(values: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  values.forEach((value, index) => {
    out[String(index)] = value;
  });
  return out;
}

function normalizeRaceControlPatch(
  patch: RaceControlMessagesState,
): RaceControlMessagesState {
  const next = structuredClone(patch) as RaceControlMessagesState;
  if (Array.isArray(next.Messages)) {
    next.Messages = arrayToIndexedObject(next.Messages);
  }
  return next;
}

export function parseRaceControlUtc(value: unknown): Date | null {
  const utc = toNonEmptyString(value);
  if (!utc) {
    return null;
  }
  const normalized =
    /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(utc)
      ? utc
      : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(utc)
        ? `${utc}Z`
        : utc;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

function resolveBeforeDate(value: RaceControlEventQuery['before']): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  return parseRaceControlUtc(value);
}

export function getRaceControlEvents(
  state: unknown,
  query: RaceControlEventQuery = {},
): RaceControlEvent[] {
  const root = isPlainObject(state) ? state : null;
  const messages = root?.Messages;
  const entries = isPlainObject(messages) ? Object.entries(messages) : [];
  const before = resolveBeforeDate(query.before);
  const driverNumber =
    query.driverNumber === undefined ? undefined : String(query.driverNumber);
  const search = normalizeComparable(query.search);

  const filtered = entries
    .map(([messageId, raw]) => {
      if (!isPlainObject(raw)) {
        return null;
      }

      const record = raw as RaceControlMessageRecord;
      const event: RaceControlEvent = {
        messageId,
        utc: toNonEmptyString(record.Utc),
        dateTime: parseRaceControlUtc(record.Utc),
        lap: toOptionalNumber(record.Lap),
        category: toNonEmptyString(record.Category),
        flag: toNonEmptyString(record.Flag),
        scope: toNonEmptyString(record.Scope),
        sector: toOptionalNumber(record.Sector),
        status: toNonEmptyString(record.Status),
        driverNumber: toNonEmptyString(record.RacingNumber),
        message: toNonEmptyString(record.Message),
      };

      if (before) {
        if (!event.dateTime || event.dateTime.getTime() > before.getTime()) {
          return null;
        }
      }
      if (!matchesExact(event.category, query.category)) {
        return null;
      }
      if (!matchesExact(event.flag, query.flag)) {
        return null;
      }
      if (!matchesExact(event.scope, query.scope)) {
        return null;
      }
      if (driverNumber !== undefined && event.driverNumber !== driverNumber) {
        return null;
      }
      if (search) {
        const haystack = [
          event.category,
          event.flag,
          event.scope,
          event.status,
          event.driverNumber,
          event.message,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) {
          return null;
        }
      }

      return event;
    })
    .filter((event): event is RaceControlEvent => event !== null);

  filtered.sort((left, right) => {
    if (left.dateTime && right.dateTime) {
      const delta = right.dateTime.getTime() - left.dateTime.getTime();
      if (delta !== 0) {
        return delta;
      }
    } else if (left.dateTime) {
      return -1;
    } else if (right.dateTime) {
      return 1;
    }
    return compareMessageIds(left.messageId, right.messageId);
  });

  if (typeof query.limit === 'number' && Number.isFinite(query.limit)) {
    return filtered.slice(0, Math.max(0, query.limit));
  }
  return filtered;
}

export class RaceControlMessagesProcessor
  implements Processor<RaceControlMessagesState>
{
  latest: RaceControlMessagesState | null = null;
  state: RaceControlMessagesState | null = null;

  process(point: RawPoint) {
    if (point.type !== 'RaceControlMessages') {
      return;
    }

    const patch = normalizeRaceControlPatch(
      (point.json ?? {}) as RaceControlMessagesState,
    );
    if (!this.state) {
      this.state = structuredClone(patch) as RaceControlMessagesState;
    } else if (isPlainObject(patch)) {
      mergeDeep(this.state as Record<string, unknown>, patch);
    } else {
      this.state = structuredClone(patch) as RaceControlMessagesState;
    }
    this.latest = this.state;
  }

  getMessages(query: RaceControlEventQuery = {}) {
    return getRaceControlEvents(this.state, query);
  }
}
