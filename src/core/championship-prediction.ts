import { isPlainObject, mergeDeep } from './processors/merge.js';

type DriverListState = Record<string, unknown> | null | undefined;

export type ChampionshipPredictionDriverEntry = Record<string, unknown> & {
  RacingNumber?: string | number | null;
  TeamName?: string | null;
  CurrentPosition?: string | number | null;
  PredictedPosition?: string | number | null;
  CurrentPoints?: string | number | null;
  PredictedPoints?: string | number | null;
};

export type ChampionshipPredictionTeamEntry = Record<string, unknown> & {
  TeamName?: string | null;
  CurrentPosition?: string | number | null;
  PredictedPosition?: string | number | null;
  CurrentPoints?: string | number | null;
  PredictedPoints?: string | number | null;
};

export type ChampionshipPredictionState = {
  Drivers?:
    | Record<string, ChampionshipPredictionDriverEntry>
    | ChampionshipPredictionDriverEntry[];
  Teams?:
    | Record<string, ChampionshipPredictionTeamEntry>
    | ChampionshipPredictionTeamEntry[];
};

export type ChampionshipPredictionDriverRecord = {
  driverNumber: string;
  driverName: string | null;
  teamName: string | null;
  currentPosition: number | null;
  predictedPosition: number | null;
  positionsGained: number | null;
  currentPoints: number | null;
  predictedPoints: number | null;
  pointsDelta: number | null;
  gapToLeaderPoints: number | null;
  raw: ChampionshipPredictionDriverEntry;
};

export type ChampionshipPredictionTeamRecord = {
  teamName: string;
  currentPosition: number | null;
  predictedPosition: number | null;
  positionsGained: number | null;
  currentPoints: number | null;
  predictedPoints: number | null;
  pointsDelta: number | null;
  gapToLeaderPoints: number | null;
  raw: ChampionshipPredictionTeamEntry;
};

function cloneState(
  state: ChampionshipPredictionState,
): ChampionshipPredictionState {
  return structuredClone(state) as ChampionshipPredictionState;
}

function compareMaybeNumericStrings(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}

function compareMaybeNullNumbers(
  left: number | null,
  right: number | null,
  direction: 'asc' | 'desc',
) {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return direction === 'asc' ? left - right : right - left;
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
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNormalizedFilter(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function getDriverListEntry(
  driverListState: DriverListState,
  driverNumber: string,
) {
  if (!isPlainObject(driverListState)) {
    return null;
  }
  const raw = driverListState[driverNumber];
  return isPlainObject(raw) ? raw : null;
}

function getDriverName(driverListState: DriverListState, driverNumber: string) {
  const entry = getDriverListEntry(driverListState, driverNumber);
  if (!entry) {
    return null;
  }
  return (
    toOptionalString(entry.FullName) ??
    toOptionalString(entry.BroadcastName) ??
    toOptionalString(entry.Tla) ??
    null
  );
}

function getDriverTeamName(
  driverListState: DriverListState,
  driverNumber: string,
) {
  const entry = getDriverListEntry(driverListState, driverNumber);
  if (!entry) {
    return null;
  }
  return toOptionalString(entry.TeamName);
}

function compareDriverRecords(
  left: ChampionshipPredictionDriverRecord,
  right: ChampionshipPredictionDriverRecord,
) {
  return (
    compareMaybeNullNumbers(
      left.predictedPosition,
      right.predictedPosition,
      'asc',
    ) ||
    compareMaybeNullNumbers(
      left.currentPosition,
      right.currentPosition,
      'asc',
    ) ||
    compareMaybeNullNumbers(
      left.predictedPoints,
      right.predictedPoints,
      'desc',
    ) ||
    compareMaybeNullNumbers(left.currentPoints, right.currentPoints, 'desc') ||
    compareMaybeNumericStrings(left.driverNumber, right.driverNumber)
  );
}

function compareTeamRecords(
  left: ChampionshipPredictionTeamRecord,
  right: ChampionshipPredictionTeamRecord,
) {
  return (
    compareMaybeNullNumbers(
      left.predictedPosition,
      right.predictedPosition,
      'asc',
    ) ||
    compareMaybeNullNumbers(
      left.currentPosition,
      right.currentPosition,
      'asc',
    ) ||
    compareMaybeNullNumbers(
      left.predictedPoints,
      right.predictedPoints,
      'desc',
    ) ||
    compareMaybeNullNumbers(left.currentPoints, right.currentPoints, 'desc') ||
    left.teamName.localeCompare(right.teamName)
  );
}

function sliceRecords<T>(records: T[], limit?: number) {
  return typeof limit === 'number' && limit > 0
    ? records.slice(0, limit)
    : records;
}

export function mergeChampionshipPredictionState(
  current: ChampionshipPredictionState | null,
  patch: unknown,
): ChampionshipPredictionState | null {
  if (!isPlainObject(patch)) {
    return current ? cloneState(current) : null;
  }

  const next = current ? cloneState(current) : {};
  mergeDeep(next as Record<string, unknown>, patch as Record<string, unknown>);
  return next;
}

export function buildChampionshipPredictionState(opts: {
  baseState?: unknown;
  timeline?: Array<{ json: unknown }>;
}): ChampionshipPredictionState | null {
  let state = mergeChampionshipPredictionState(null, opts.baseState ?? null);
  for (const point of opts.timeline ?? []) {
    state = mergeChampionshipPredictionState(state, point?.json ?? null);
  }
  return state;
}

export function getChampionshipPredictionDrivers(opts: {
  state: unknown;
  driverListState?: DriverListState;
  driverNumber?: string | number;
  teamName?: string | null;
  limit?: number;
}): ChampionshipPredictionDriverRecord[] {
  const requestedDriver =
    opts.driverNumber === undefined ? null : String(opts.driverNumber);
  const requestedTeam = toNormalizedFilter(opts.teamName ?? null);

  const records: ChampionshipPredictionDriverRecord[] = [];
  for (const [driverKey, raw] of toOrderedEntries(
    (opts.state as ChampionshipPredictionState | null)?.Drivers,
  )) {
    if (!isPlainObject(raw)) {
      continue;
    }

    const entry = raw as ChampionshipPredictionDriverEntry;
    const driverNumber = toOptionalString(entry.RacingNumber) ?? driverKey;
    const teamName =
      toOptionalString(entry.TeamName) ??
      getDriverTeamName(opts.driverListState, driverNumber);

    if (requestedDriver !== null && driverNumber !== requestedDriver) {
      continue;
    }
    if (
      requestedTeam !== null &&
      !(teamName?.toLowerCase().includes(requestedTeam) ?? false)
    ) {
      continue;
    }

    const currentPosition = toOptionalNumber(entry.CurrentPosition);
    const predictedPosition = toOptionalNumber(entry.PredictedPosition);
    const currentPoints = toOptionalNumber(entry.CurrentPoints);
    const predictedPoints = toOptionalNumber(entry.PredictedPoints);

    records.push({
      driverNumber,
      driverName: getDriverName(opts.driverListState, driverNumber),
      teamName,
      currentPosition,
      predictedPosition,
      positionsGained:
        currentPosition !== null && predictedPosition !== null
          ? currentPosition - predictedPosition
          : null,
      currentPoints,
      predictedPoints,
      pointsDelta:
        currentPoints !== null && predictedPoints !== null
          ? predictedPoints - currentPoints
          : null,
      gapToLeaderPoints: null,
      raw: structuredClone(entry) as ChampionshipPredictionDriverEntry,
    });
  }

  records.sort(compareDriverRecords);

  const leaderPoints = records.reduce<number | null>((best, record) => {
    if (record.predictedPoints === null) {
      return best;
    }
    if (best === null || record.predictedPoints > best) {
      return record.predictedPoints;
    }
    return best;
  }, null);

  return sliceRecords(
    records.map((record) => ({
      ...record,
      gapToLeaderPoints:
        leaderPoints !== null && record.predictedPoints !== null
          ? leaderPoints - record.predictedPoints
          : null,
    })),
    opts.limit,
  );
}

export function getChampionshipPredictionTeams(opts: {
  state: unknown;
  teamName?: string | null;
  limit?: number;
}): ChampionshipPredictionTeamRecord[] {
  const requestedTeam = toNormalizedFilter(opts.teamName ?? null);

  const records: ChampionshipPredictionTeamRecord[] = [];
  for (const [teamKey, raw] of toOrderedEntries(
    (opts.state as ChampionshipPredictionState | null)?.Teams,
  )) {
    if (!isPlainObject(raw)) {
      continue;
    }

    const entry = raw as ChampionshipPredictionTeamEntry;
    const teamName = toOptionalString(entry.TeamName) ?? teamKey;

    if (
      requestedTeam !== null &&
      !teamName.toLowerCase().includes(requestedTeam)
    ) {
      continue;
    }

    const currentPosition = toOptionalNumber(entry.CurrentPosition);
    const predictedPosition = toOptionalNumber(entry.PredictedPosition);
    const currentPoints = toOptionalNumber(entry.CurrentPoints);
    const predictedPoints = toOptionalNumber(entry.PredictedPoints);

    records.push({
      teamName,
      currentPosition,
      predictedPosition,
      positionsGained:
        currentPosition !== null && predictedPosition !== null
          ? currentPosition - predictedPosition
          : null,
      currentPoints,
      predictedPoints,
      pointsDelta:
        currentPoints !== null && predictedPoints !== null
          ? predictedPoints - currentPoints
          : null,
      gapToLeaderPoints: null,
      raw: structuredClone(entry) as ChampionshipPredictionTeamEntry,
    });
  }

  records.sort(compareTeamRecords);

  const leaderPoints = records.reduce<number | null>((best, record) => {
    if (record.predictedPoints === null) {
      return best;
    }
    if (best === null || record.predictedPoints > best) {
      return record.predictedPoints;
    }
    return best;
  }, null);

  return sliceRecords(
    records.map((record) => ({
      ...record,
      gapToLeaderPoints:
        leaderPoints !== null && record.predictedPoints !== null
          ? leaderPoints - record.predictedPoints
          : null,
    })),
    opts.limit,
  );
}
