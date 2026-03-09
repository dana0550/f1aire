import { isPlainObject } from './processors/merge.js';

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asRecord<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown,
): T | null {
  return isPlainObject(value) ? (value as T) : null;
}

export const CAR_DATA_CHANNEL_KEYS = {
  rpm: '0',
  speed: '2',
  gear: '3',
  throttle: '4',
  brake: '5',
  drs: '45',
} as const;

export type CarDataChannelKey =
  (typeof CAR_DATA_CHANNEL_KEYS)[keyof typeof CAR_DATA_CHANNEL_KEYS];

export type CarDataChannels = Record<string, unknown> &
  Partial<Record<CarDataChannelKey, number | string | null>>;

export type DecodedCarChannels = {
  rpm: number | null;
  speed: number | null;
  gear: number | null;
  throttle: number | null;
  brake: number | null;
  drs: number | null;
};

export type CarDataCar = Record<string, unknown> & {
  Channels?: CarDataChannels | null;
};

export type CarDataEntry = Record<string, unknown> & {
  Utc?: string | null;
  Cars?: Record<string, CarDataCar> | null;
};

export type CarDataState = {
  Entries: CarDataEntry[];
};

export function decodeCarChannels(
  channels: unknown,
): DecodedCarChannels | null {
  const raw = asRecord<CarDataChannels>(channels);
  if (!raw) {
    return null;
  }

  const read = (key: CarDataChannelKey) => toFiniteNumber(raw[key]);

  return {
    rpm: read(CAR_DATA_CHANNEL_KEYS.rpm),
    speed: read(CAR_DATA_CHANNEL_KEYS.speed),
    gear: read(CAR_DATA_CHANNEL_KEYS.gear),
    throttle: read(CAR_DATA_CHANNEL_KEYS.throttle),
    brake: read(CAR_DATA_CHANNEL_KEYS.brake),
    drs: read(CAR_DATA_CHANNEL_KEYS.drs),
  };
}

export function getCarDataEntries(state: unknown): CarDataEntry[] {
  const root = asRecord<{ Entries?: unknown }>(state);
  if (!Array.isArray(root?.Entries)) {
    return [];
  }

  return root.Entries.filter((entry): entry is CarDataEntry =>
    isPlainObject(entry),
  );
}

export function getLatestCarDataEntry(state: unknown): CarDataEntry | null {
  return getCarDataEntries(state).at(-1) ?? null;
}

export function getCarDataCars(entry: unknown): Record<string, CarDataCar> {
  const root = asRecord<CarDataEntry>(entry);
  return asRecord<Record<string, CarDataCar>>(root?.Cars) ?? {};
}

export type PositionEntry = Record<string, unknown> & {
  Status?: string | number | null;
  X?: number | string | null;
  Y?: number | string | null;
  Z?: number | string | null;
};

export type PositionBatch = Record<string, unknown> & {
  Timestamp?: string | null;
  Entries?: Record<string, PositionEntry> | null;
};

export type PositionState = {
  Position: PositionBatch[];
};

export type DecodedPositionEntry = {
  status: string | null;
  x: number | null;
  y: number | null;
  z: number | null;
};

export function decodePositionEntry(
  entry: unknown,
): DecodedPositionEntry | null {
  const raw = asRecord<PositionEntry>(entry);
  if (!raw) {
    return null;
  }

  const status =
    raw.Status === null || raw.Status === undefined
      ? null
      : String(raw.Status).trim() || null;

  return {
    status,
    x: toFiniteNumber(raw.X),
    y: toFiniteNumber(raw.Y),
    z: toFiniteNumber(raw.Z),
  };
}

export function getPositionBatches(state: unknown): PositionBatch[] {
  const root = asRecord<{ Position?: unknown }>(state);
  if (!Array.isArray(root?.Position)) {
    return [];
  }

  return root.Position.filter((batch): batch is PositionBatch =>
    isPlainObject(batch),
  );
}

export function getLatestPositionBatch(state: unknown): PositionBatch | null {
  return getPositionBatches(state).at(-1) ?? null;
}

export function getPositionEntries(
  batch: unknown,
): Record<string, PositionEntry> {
  const root = asRecord<PositionBatch>(batch);
  return asRecord<Record<string, PositionEntry>>(root?.Entries) ?? {};
}
